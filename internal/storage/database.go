// Package storage handles all database actions
package storage

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/logger"
	"github.com/klauspost/compress/zstd"
	"github.com/leporo/sqlf"

	// pgx PostgreSQL driver (database/sql compatible)
	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	db           *sql.DB
	dbLastAction time.Time

	// zstd compression encoder & decoder
	dbEncoder    *zstd.Encoder
	dbDecoder, _ = zstd.NewReader(nil)

	temporaryFiles = []string{}
)

// InitDB will initialise the database
func InitDB() error {
	var err error

	if config.Compression > 0 {
		var compression zstd.EncoderLevel
		switch config.Compression {
		case 1:
			compression = zstd.SpeedFastest
		case 2:
			compression = zstd.SpeedDefault
		case 3:
			compression = zstd.SpeedBestCompression
		}
		dbEncoder, err = zstd.NewWriter(nil, zstd.WithEncoderLevel(compression))
		if err != nil {
			return err
		}
		logger.Log().Debugf("[db] storing messages with compression: %s", compression.String())
	} else {
		logger.Log().Debug("[db] storing messages with no compression")
	}

	dsn := config.Database
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		return errors.New("[db] no database configured, set MP_DATABASE or DATABASE_URL to a PostgreSQL connection string")
	}
	config.Database = dsn

	logger.Log().Debug("[db] opening PostgreSQL database")

	db, err = sql.Open("pgx", dsn)
	if err != nil {
		return err
	}

	for i := 1; i < 6; i++ {
		if err := Ping(); err != nil {
			logger.Log().Errorf("[db] %s", err.Error())
			logger.Log().Infof("[db] reconnecting in 5 seconds (attempt %d/5)", i)
			time.Sleep(5 * time.Second)
		} else {
			break
		}
	}

	// PostgreSQL handles concurrent access, so use a real connection pool.
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(time.Hour)

	// sqlf uses ? placeholders by default; PostgreSQL requires $N.
	sqlf.SetDialect(sqlf.PostgreSQL)

	// Ensure the non-owner role that Row-Level Security policies apply to exists.
	// Requires CREATEROLE/superuser; on managed databases without it, the role
	// should be pre-created by an operator (the schema grants then succeed).
	if _, err := db.Exec(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '` + rlsRole + `') THEN CREATE ROLE ` + rlsRole + ` NOLOGIN; END IF; END $$;`); err != nil {
		logger.Log().Warnf("[db] could not ensure RLS role %q exists (pre-create it if this persists): %s", rlsRole, err.Error())
	}

	// create tables if necessary & apply migrations
	if err := dbApplySchemas(); err != nil {
		return err
	}

	LoadTagFilters()

	dbLastAction = time.Now()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
	go func() {
		s := <-sigs
		logger.Log().Debugf("[db] got %s signal, shutting down", s)
		Close()
		os.Exit(0)
	}()

	// auto-prune & delete
	go dbCron()

	go dataMigrations()

	return nil
}

// Tenant applies an optional prefix to the table name
func tenant(table string) string {
	return config.TenantID + table
}

// Close will close the database
func Close() {
	if db != nil {
		if err := db.Close(); err != nil {
			logger.Log().Warn("[db] error closing database, ignoring")
		}
	}

	// delete any temporary files (self-signed certs, unix sockets)
	deleteTempFiles()
}

// Ping the database connection and return an error if unsuccessful
func Ping() error {
	return db.Ping()
}

// StatsGet returns the total/unread statistics for a mailbox
func StatsGet() MailboxStats {
	var (
		total  = CountTotal()
		unread = CountUnread()
		tags   = GetAllTags()
	)

	dbLastAction = time.Now()

	return MailboxStats{
		Total:  total,
		Unread: unread,
		Tags:   tags,
	}
}

// CountTotal returns the number of emails in the database
func CountTotal() uint64 {
	var total float64 // use float64 for numeric scan compatibility

	_ = sqlf.From(tenant("mailbox")).
		Select("COUNT(*)").To(&total).
		QueryRowAndClose(context.TODO(), db)

	return uint64(total)
}

// CountUnread returns the number of emails in the database that are unread.
func CountUnread() uint64 {
	var total float64

	_ = sqlf.From(tenant("mailbox")).
		Select("COUNT(*)").To(&total).
		Where("Read = ?", 0).
		QueryRowAndClose(context.TODO(), db)

	return uint64(total)
}

// CountRead returns the number of emails in the database that are read.
func CountRead() uint64 {
	var total float64

	_ = sqlf.From(tenant("mailbox")).
		Select("COUNT(*)").To(&total).
		Where("Read = ?", 1).
		QueryRowAndClose(context.TODO(), db)

	return uint64(total)
}

// DbSize returns the size of the database.
func DbSize() uint64 {
	var total sql.NullFloat64

	err := db.QueryRow("SELECT pg_database_size(current_database())").Scan(&total)
	if err != nil {
		logger.Log().Errorf("[db] %s", err.Error())
	}

	return uint64(total.Float64)
}

// MessageIDExists checks whether a Message-ID exists in the DB
func MessageIDExists(id string) bool {
	var total int

	_ = sqlf.From(tenant("mailbox")).
		Select("COUNT(*)").To(&total).
		Where("MessageID = ?", id).
		QueryRowAndClose(context.TODO(), db)

	return total != 0
}
