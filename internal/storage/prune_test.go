package storage

import (
	"context"
	"testing"

	"github.com/axllent/mailpit/config"
)

func storeInSandbox(t *testing.T, sandboxID string) {
	t.Helper()
	raw := []byte("From: a@x.test\r\nTo: b@" + sandboxID + ".mail.test\r\nSubject: s\r\n\r\nbody\r\n")
	if _, err := Store(WithSandbox(context.Background(), sandboxID), &raw, nil); err != nil {
		t.Fatalf("store in %s: %v", sandboxID, err)
	}
}

func countSandbox(t *testing.T, sandboxID string) int {
	t.Helper()
	msgs, err := List(WithSandbox(context.Background(), sandboxID), 0, 0, 1000)
	if err != nil {
		t.Fatalf("list %s: %v", sandboxID, err)
	}
	return len(msgs)
}

func TestTenantPruning(t *testing.T) {
	setup("")
	defer Close()

	config.MultiTenant = true
	t.Cleanup(func() { config.MultiTenant = false })

	if err := CreateAccount("acc-p", "pro"); err != nil {
		t.Fatal(err)
	}
	if err := CreateSandbox("sp1", "acc-p", "sp1"); err != nil {
		t.Fatal(err)
	}
	if err := CreateSandbox("sp2", "acc-p", "sp2"); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		storeInSandbox(t, "sp1")
	}
	for i := 0; i < 3; i++ {
		storeInSandbox(t, "sp2")
	}

	// prune sandbox sp1 to at most 2 messages
	n, err := PruneSandbox("sp1", 2, 0)
	if err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("PruneSandbox pruned %d, want 3", n)
	}
	if c := countSandbox(t, "sp1"); c != 2 {
		t.Fatalf("sp1 has %d, want 2", c)
	}
	if c := countSandbox(t, "sp2"); c != 3 {
		t.Fatalf("sp2 has %d, want 3 (should be untouched)", c)
	}

	// account now has 2 + 3 = 5; prune the account to at most 3
	n2, err := PruneAccount("acc-p", 3, 0)
	if err != nil {
		t.Fatal(err)
	}
	if n2 != 2 {
		t.Fatalf("PruneAccount pruned %d, want 2", n2)
	}
	if total := countSandbox(t, "sp1") + countSandbox(t, "sp2"); total != 3 {
		t.Fatalf("account total %d, want 3", total)
	}
}
