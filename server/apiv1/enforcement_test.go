package apiv1

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

func seedMessage(t *testing.T, sandboxID, subject string) {
	t.Helper()
	raw := []byte("From: a@example.test\r\nTo: b@example.test\r\nSubject: " + subject + "\r\n\r\nbody\r\n")
	if _, err := storage.Store(storage.WithSandbox(context.Background(), sandboxID), &raw, nil); err != nil {
		t.Fatalf("seed %s: %v", sandboxID, err)
	}
}

// TestSandboxEnforcement proves the auth middleware scopes GET /messages to the
// requested sandbox, and rejects unauthenticated and cross-account requests.
func TestSandboxEnforcement(t *testing.T) {
	initTestDB(t)
	config.MultiTenant = true
	t.Cleanup(func() { config.MultiTenant = false })
	identity.Configure("test-secret", 0, 0)

	mustDo := func(err error, what string) {
		if err != nil {
			t.Fatalf("%s: %v", what, err)
		}
	}
	mustDo(storage.CreateAccount("acc-1", "pro"), "acc-1")
	mustDo(storage.CreateAccount("acc-2", "pro"), "acc-2")
	mustDo(storage.CreateSandbox("sb-a", "acc-1", "a"), "sb-a")
	mustDo(storage.CreateSandbox("sb-b", "acc-1", "b"), "sb-b")
	mustDo(storage.CreateSandbox("sb-c", "acc-2", "c"), "sb-c")

	hash, err := identity.HashPassword("pw")
	mustDo(err, "hash")
	mustDo(storage.CreateUser("u1", "acc-1", "u1@example.com", hash, "owner"), "u1")

	seedMessage(t, "sb-a", "hello-a1")
	seedMessage(t, "sb-a", "hello-a2")
	seedMessage(t, "sb-b", "hello-b1")

	access, err := identity.IssueAccessToken("u1", "acc-1", 1)
	mustDo(err, "token")

	get := func(sandbox, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/api/v1/messages", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if sandbox != "" {
			req.Header.Set("X-Sandbox-ID", sandbox)
		}
		rec := httptest.NewRecorder()
		RequireAuth(GetMessages)(rec, req)
		return rec
	}

	count := func(rec *httptest.ResponseRecorder) int {
		var resp MessagesSummary
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode: %v (body %s)", err, rec.Body.String())
		}
		return len(resp.Messages)
	}

	// sandbox A sees only its 2 messages
	if rec := get("sb-a", access); rec.Code != http.StatusOK || count(rec) != 2 {
		t.Fatalf("sb-a: code=%d count=%d, want 200/2", rec.Code, count(rec))
	}
	// sandbox B sees only its 1 message
	if rec := get("sb-b", access); rec.Code != http.StatusOK || count(rec) != 1 {
		t.Fatalf("sb-b: code=%d count=%d, want 200/1", rec.Code, count(rec))
	}
	// no token -> 401
	if rec := get("sb-a", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: want 401, got %d", rec.Code)
	}
	// sandbox owned by another account -> 403
	if rec := get("sb-c", access); rec.Code != http.StatusForbidden {
		t.Fatalf("cross-account: want 403, got %d", rec.Code)
	}
}
