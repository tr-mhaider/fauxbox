package storage

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/plans"
	"github.com/axllent/mailpit/internal/shortuuid"
)

// Control-plane column ownership (Phase 12): provisioning owns the accounts and
// sandboxes rows and the limit columns, and creates the first users row. It does
// not touch mail data, api_tokens, or (except to force re-auth) token_version.

// ProvisionedSandbox is a sandbox created during provisioning. SMTPPassword is
// the generated plaintext, returned once and never stored in the clear.
type ProvisionedSandbox struct {
	ID           string `json:"id"`
	Subdomain    string `json:"subdomain"`
	SMTPUsername string `json:"smtp_username"`
	SMTPPassword string `json:"smtp_password"`
}

// ProvisionResult is the outcome of a signup/provisioning call.
type ProvisionResult struct {
	AccountID string               `json:"account_id"`
	UserID    string               `json:"user_id"`
	Plan      string               `json:"plan"`
	Sandboxes []ProvisionedSandbox `json:"sandboxes"`
}

func randToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ProvisionAccount creates an account, its sandboxes (each with a unique
// subdomain and generated SMTP credentials), the plan's limits, and the first
// owner user, all in one transaction. userPasswordHash is a pre-hashed password.
func ProvisionAccount(planName, email, userPasswordHash string, subdomains []string) (*ProvisionResult, error) {
	plan, ok := plans.Get(planName)
	if !ok {
		return nil, fmt.Errorf("unknown plan %q", planName)
	}
	if email == "" || userPasswordHash == "" {
		return nil, errors.New("email and password are required")
	}
	if len(subdomains) == 0 {
		return nil, errors.New("at least one subdomain is required")
	}
	if plan.MaxSandboxes > 0 && len(subdomains) > plan.MaxSandboxes {
		return nil, fmt.Errorf("plan %q allows at most %d sandboxes", plan.Name, plan.MaxSandboxes)
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }() // no-op after a successful Commit

	now := time.Now().UnixMilli()
	accountID := shortuuid.New()
	if _, err := tx.Exec(`INSERT INTO `+tenant("accounts")+
		` (ID, Plan, MaxMessages, MaxStorageBytes, MaxSandboxes, RateLimit, Created) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		accountID, plan.Name, plan.MaxMessages, plan.MaxStorageBytes, plan.MaxSandboxes, plan.RateLimit, now); err != nil {
		return nil, fmt.Errorf("create account: %w", err)
	}

	res := &ProvisionResult{AccountID: accountID, Plan: plan.Name}
	for _, sub := range subdomains {
		sandboxID := shortuuid.New()
		smtpPass, err := randToken(16)
		if err != nil {
			return nil, err
		}
		smtpHash, err := identity.HashPassword(smtpPass)
		if err != nil {
			return nil, err
		}
		// SMTP username = subdomain, which is globally unique (UNIQUE constraint).
		if _, err := tx.Exec(`INSERT INTO `+tenant("sandboxes")+
			` (ID, AccountID, Subdomain, SMTPUsername, SMTPPasswordHash, MaxMessages, MaxMessageSize, RetentionHours, RateLimit, Created)`+
			` VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			sandboxID, accountID, sub, sub, smtpHash,
			plan.SandboxMaxMessages, plan.SandboxMaxMessageSize, plan.SandboxRetentionHours, plan.SandboxRateLimit, now); err != nil {
			return nil, fmt.Errorf("create sandbox %q: %w", sub, err)
		}
		res.Sandboxes = append(res.Sandboxes, ProvisionedSandbox{
			ID: sandboxID, Subdomain: sub, SMTPUsername: sub, SMTPPassword: smtpPass,
		})
	}

	userID := shortuuid.New()
	if _, err := tx.Exec(`INSERT INTO `+tenant("users")+
		` (ID, AccountID, Email, PasswordHash, Role, TokenVersion, Created) VALUES ($1,$2,$3,$4,'owner',1,$5)`,
		userID, accountID, email, userPasswordHash, now); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	res.UserID = userID

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return res, nil
}

// SetAccountPlan changes an account's plan, updating its limit columns and those
// of all its sandboxes. The data plane reads these live, so no redeploy is
// needed. It does not force re-auth (an upgrade should not log users out).
func SetAccountPlan(accountID, planName string) error {
	plan, ok := plans.Get(planName)
	if !ok {
		return fmt.Errorf("unknown plan %q", planName)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	r, err := tx.Exec(`UPDATE `+tenant("accounts")+
		` SET Plan=$1, MaxMessages=$2, MaxStorageBytes=$3, MaxSandboxes=$4, RateLimit=$5 WHERE ID=$6`,
		plan.Name, plan.MaxMessages, plan.MaxStorageBytes, plan.MaxSandboxes, plan.RateLimit, accountID)
	if err != nil {
		return err
	}
	if n, _ := r.RowsAffected(); n == 0 {
		return errors.New("account not found")
	}
	if _, err := tx.Exec(`UPDATE `+tenant("sandboxes")+
		` SET MaxMessages=$1, MaxMessageSize=$2, RetentionHours=$3, RateLimit=$4 WHERE AccountID=$5`,
		plan.SandboxMaxMessages, plan.SandboxMaxMessageSize, plan.SandboxRetentionHours, plan.SandboxRateLimit, accountID); err != nil {
		return err
	}
	return tx.Commit()
}

// CancelAccount downgrades an account to the free plan and bumps every user's
// TokenVersion, which invalidates their existing sessions and forces re-auth on
// their next request (Phase 3 checks TokenVersion). ponytail: no hard "disabled"
// flag exists on accounts; a downgrade-to-free + forced re-auth is the minimal
// cancellation. A true login block would need a schema column, deferred.
func CancelAccount(accountID string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`UPDATE `+tenant("users")+` SET TokenVersion = TokenVersion + 1 WHERE AccountID=$1`, accountID); err != nil {
		return err
	}
	free, _ := plans.Get("free")
	r, err := tx.Exec(`UPDATE `+tenant("accounts")+
		` SET Plan=$1, MaxMessages=$2, MaxStorageBytes=$3, MaxSandboxes=$4, RateLimit=$5 WHERE ID=$6`,
		"canceled", free.MaxMessages, free.MaxStorageBytes, free.MaxSandboxes, free.RateLimit, accountID)
	if err != nil {
		return err
	}
	if n, _ := r.RowsAffected(); n == 0 {
		return errors.New("account not found")
	}
	if _, err := tx.Exec(`UPDATE `+tenant("sandboxes")+
		` SET MaxMessages=$1, MaxMessageSize=$2, RetentionHours=$3, RateLimit=$4 WHERE AccountID=$5`,
		free.SandboxMaxMessages, free.SandboxMaxMessageSize, free.SandboxRetentionHours, free.SandboxRateLimit, accountID); err != nil {
		return err
	}
	return tx.Commit()
}
