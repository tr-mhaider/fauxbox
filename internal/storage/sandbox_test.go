package storage

import (
	"context"
	"testing"
	"time"

	"github.com/leporo/sqlf"
)

func insertScoped(t *testing.T, ctx context.Context, id string) {
	t.Helper()
	err := withScope(ctx, func(ex sqlf.Executor) error {
		_, e := ex.ExecContext(ctx,
			`INSERT INTO `+tenant("mailbox")+` (Created, ID, MessageID, Subject, Size, Inline, Attachments) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			time.Now().UnixMilli(), id, id+"@test", "iso", 10, 0, 0)
		return e
	})
	if err != nil {
		t.Fatalf("insert %s: %v", id, err)
	}
}

func countScoped(t *testing.T, ctx context.Context) int {
	t.Helper()
	var n int
	err := withScope(ctx, func(ex sqlf.Executor) error {
		return ex.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+tenant("mailbox")).Scan(&n)
	})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// TestSandboxIsolation proves Row-Level Security keeps sandboxes apart: a
// scoped read only sees its own sandbox's rows, and a bypass read sees all.
func TestSandboxIsolation(t *testing.T) {
	setup("")
	defer Close()

	ctxA := WithSandbox(context.Background(), "sbx-a")
	ctxB := WithSandbox(context.Background(), "sbx-b")
	ctxBypass := WithBypass(context.Background())

	insertScoped(t, ctxA, "iso-a-1")
	insertScoped(t, ctxA, "iso-a-2")
	insertScoped(t, ctxB, "iso-b-1")

	if got := countScoped(t, ctxA); got != 2 {
		t.Fatalf("sandbox A sees %d rows, want 2 (RLS leak?)", got)
	}
	if got := countScoped(t, ctxB); got != 1 {
		t.Fatalf("sandbox B sees %d rows, want 1 (RLS leak?)", got)
	}
	if got := countScoped(t, ctxBypass); got != 3 {
		t.Fatalf("bypass sees %d rows, want 3", got)
	}
}
