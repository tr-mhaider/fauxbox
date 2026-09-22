package storage

import "time"

// Sandbox is an isolated inbox owned by an account; its ID is the row-level
// tenant key on the mail tables. The sandboxes table is not under RLS, so these
// functions use the connection pool directly.
type Sandbox struct {
	ID             string
	AccountID      string
	Subdomain      string
	SMTPUsername   string
	MaxMessages    int64
	MaxMessageSize int64
	RetentionHours int
	RateLimit      int
	WebhookURL     string
}

const sandboxCols = `ID, AccountID, COALESCE(Subdomain, ''), COALESCE(SMTPUsername, ''), MaxMessages, MaxMessageSize, RetentionHours, RateLimit, COALESCE(WebhookURL, '')`

func scanSandbox(row interface{ Scan(...any) error }) (*Sandbox, error) {
	s := &Sandbox{}
	err := row.Scan(&s.ID, &s.AccountID, &s.Subdomain, &s.SMTPUsername, &s.MaxMessages, &s.MaxMessageSize, &s.RetentionHours, &s.RateLimit, &s.WebhookURL)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// CreateSandbox inserts a sandbox.
func CreateSandbox(id, accountID, subdomain string) error {
	_, err := db.Exec(`INSERT INTO `+tenant("sandboxes")+` (ID, AccountID, Subdomain, Created) VALUES ($1, $2, $3, $4) ON CONFLICT (ID) DO NOTHING`,
		id, accountID, subdomain, time.Now().UnixMilli())
	return err
}

// GetSandboxByID returns a sandbox by ID.
func GetSandboxByID(id string) (*Sandbox, error) {
	return scanSandbox(db.QueryRow(`SELECT `+sandboxCols+` FROM `+tenant("sandboxes")+` WHERE ID = $1`, id))
}

// GetSandboxBySubdomain returns a sandbox by its subdomain (case-insensitive).
func GetSandboxBySubdomain(subdomain string) (*Sandbox, error) {
	return scanSandbox(db.QueryRow(`SELECT `+sandboxCols+` FROM `+tenant("sandboxes")+` WHERE Subdomain = $1`, subdomain))
}

// GetSandboxBySMTPUsername returns a sandbox by its SMTP username (Phase 4).
func GetSandboxBySMTPUsername(username string) (*Sandbox, error) {
	return scanSandbox(db.QueryRow(`SELECT `+sandboxCols+` FROM `+tenant("sandboxes")+` WHERE SMTPUsername = $1`, username))
}

// SetSandboxSMTP sets a sandbox's SMTP username and (already-hashed) password.
func SetSandboxSMTP(id, username, passwordHash string) error {
	_, err := db.Exec(`UPDATE `+tenant("sandboxes")+` SET SMTPUsername = $1, SMTPPasswordHash = $2 WHERE ID = $3`, username, passwordHash, id)
	return err
}

// SandboxSMTPPasswordHash returns the stored bcrypt hash for an SMTP username,
// used to authenticate inbound SMTP connections.
func SandboxSMTPPasswordHash(username string) (string, error) {
	var h string
	err := db.QueryRow(`SELECT COALESCE(SMTPPasswordHash, '') FROM `+tenant("sandboxes")+` WHERE SMTPUsername = $1`, username).Scan(&h)
	return h, err
}
