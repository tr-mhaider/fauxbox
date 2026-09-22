package storage

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"time"

	"github.com/axllent/mailpit/internal/shortuuid"
)

// APIToken is a programmatic access token for an account (Send API / API access).
// The raw token is returned only once, at creation; only its hash is stored.
type APIToken struct {
	ID      string
	Scopes  string
	Created int64
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// CreateAPIToken creates a token for an account and returns (id, rawToken).
// The raw token is not recoverable afterwards.
func CreateAPIToken(accountID, scopes string) (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw := base64.RawURLEncoding.EncodeToString(b)
	id := shortuuid.New()

	_, err := db.Exec(`INSERT INTO `+tenant("api_tokens")+` (ID, AccountID, TokenHash, Scopes, Created) VALUES ($1, $2, $3, $4, $5)`,
		id, accountID, hashToken(raw), scopes, time.Now().UnixMilli())
	if err != nil {
		return "", "", err
	}

	return id, raw, nil
}

// GetAPITokenAccount returns the account ID and scopes for a raw token, or an
// error if it does not exist.
func GetAPITokenAccount(raw string) (string, string, error) {
	var accountID, scopes string
	err := db.QueryRow(`SELECT AccountID, COALESCE(Scopes, '') FROM `+tenant("api_tokens")+` WHERE TokenHash = $1`, hashToken(raw)).
		Scan(&accountID, &scopes)
	if err != nil {
		return "", "", err
	}
	return accountID, scopes, nil
}

// ListAPITokens lists an account's tokens (without the secret).
func ListAPITokens(accountID string) ([]APIToken, error) {
	rows, err := db.Query(`SELECT ID, COALESCE(Scopes, ''), Created FROM `+tenant("api_tokens")+` WHERE AccountID = $1 ORDER BY Created DESC`, accountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	tokens := []APIToken{}
	for rows.Next() {
		var t APIToken
		var created float64
		if err := rows.Scan(&t.ID, &t.Scopes, &created); err != nil {
			return nil, err
		}
		t.Created = int64(created)
		tokens = append(tokens, t)
	}
	return tokens, rows.Err()
}

// DeleteAPIToken revokes one of an account's tokens.
func DeleteAPIToken(accountID, id string) error {
	res, err := db.Exec(`DELETE FROM `+tenant("api_tokens")+` WHERE ID = $1 AND AccountID = $2`, id, accountID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
