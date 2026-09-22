package storage

import (
	"context"

	"github.com/axllent/mailpit/config"
	"github.com/leporo/sqlf"
)

// rlsRole is the non-owner PostgreSQL role that Row-Level Security policies
// apply to. Sandbox-scoped operations SET LOCAL ROLE to it inside their
// transaction; bypass operations run as the (owning) login role, which is not
// subject to RLS.
const rlsRole = "mailpit_rls"

type ctxKey int

const sandboxKey ctxKey = 0

type scope struct {
	sandboxID string
	bypass    bool
}

// WithSandbox scopes all storage operations on the returned context to a single
// sandbox. Reads and writes are filtered to that sandbox by Row-Level Security.
func WithSandbox(ctx context.Context, sandboxID string) context.Context {
	return context.WithValue(ctx, sandboxKey, scope{sandboxID: sandboxID})
}

// WithBypass returns a context that bypasses sandbox isolation, for
// cross-sandbox maintenance (cron pruning, stats, admin) and for callers not
// yet threaded with a sandbox identity.
func WithBypass(ctx context.Context) context.Context {
	return context.WithValue(ctx, sandboxKey, scope{bypass: true})
}

// scopeFromCtx returns the sandbox scope carried by ctx. When none is set the
// default depends on the mode: in single-tenant mode it is bypass (unchanged
// behavior); in multi-tenant mode it is a fail-closed empty sandbox, so any
// storage path not yet threaded with a real sandbox returns nothing and rejects
// writes rather than leaking across tenants.
func scopeFromCtx(ctx context.Context) scope {
	if s, ok := ctx.Value(sandboxKey).(scope); ok {
		return s
	}
	if config.MultiTenant {
		return scope{sandboxID: ""}
	}
	return scope{bypass: true}
}

// withScope runs fn inside a transaction. For a sandbox-scoped context it sets
// the RLS role and the app.current_sandbox GUC (transaction-local) so every
// query fn issues is filtered to that sandbox; for a bypass context it runs as
// the login role with no filtering.
func withScope(ctx context.Context, fn func(ex sqlf.Executor) error) error {
	s := scopeFromCtx(ctx)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if !s.bypass {
		if _, err := tx.ExecContext(ctx, "SET LOCAL ROLE "+rlsRole); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "SELECT set_config('app.current_sandbox', $1, true)", s.sandboxID); err != nil {
			return err
		}
	}

	if err := fn(tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true

	return nil
}
