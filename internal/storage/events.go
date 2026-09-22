package storage

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/logger"
	"github.com/jackc/pgx/v5"
)

const eventChannel = "fauxbox_events"

// SandboxEvent is a small cross-node realtime notification. Payloads are kept
// minimal (the UI re-fetches on receipt) to stay well under the 8 KB NOTIFY limit.
type SandboxEvent struct {
	Sandbox string `json:"sandbox"`
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
}

// NotifyEvent publishes an event to every node via PostgreSQL NOTIFY.
func NotifyEvent(sandboxID, eventType, id string) {
	payload, err := json.Marshal(SandboxEvent{Sandbox: sandboxID, Type: eventType, ID: id})
	if err != nil {
		return
	}
	if _, err := db.Exec(`SELECT pg_notify($1, $2)`, eventChannel, string(payload)); err != nil {
		logger.Log().Errorf("[events] notify: %s", err.Error())
	}
}

// StartEventListener opens a dedicated connection (not from the pool), LISTENs
// for events, and calls handler for each. It reconnects with backoff and returns
// when ctx is cancelled. Run one per node.
func StartEventListener(ctx context.Context, handler func(SandboxEvent)) {
	dsn := config.Database
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}

	for {
		if ctx.Err() != nil {
			return
		}
		if err := listenLoop(ctx, dsn, handler); err != nil && ctx.Err() == nil {
			logger.Log().Warnf("[events] listener error, reconnecting in 5s: %s", err.Error())
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
			}
		}
	}
}

func listenLoop(ctx context.Context, dsn string, handler func(SandboxEvent)) error {
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close(context.Background()) }()

	if _, err := conn.Exec(ctx, "LISTEN "+eventChannel); err != nil {
		return err
	}

	for {
		n, err := conn.WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var ev SandboxEvent
		if err := json.Unmarshal([]byte(n.Payload), &ev); err != nil {
			continue
		}
		handler(ev)
	}
}
