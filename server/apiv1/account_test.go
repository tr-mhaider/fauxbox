package apiv1

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

func TestAccountManagementAndTokens(t *testing.T) {
	initTestDB(t)
	config.MultiTenant = true
	t.Cleanup(func() { config.MultiTenant = false })
	identity.Configure("test-secret", 0, 0)

	if err := storage.CreateAccount("acct-x", "pro"); err != nil {
		t.Fatal(err)
	}
	if err := storage.CreateSandbox("sbx-x", "acct-x", "subx"); err != nil {
		t.Fatal(err)
	}
	hash, _ := identity.HashPassword("pw")
	if err := storage.CreateUser("owner-x", "acct-x", "owner@x.com", hash, "owner"); err != nil {
		t.Fatal(err)
	}
	access, _ := identity.IssueAccessToken("owner-x", "acct-x", 1)

	seedMessage(t, "sbx-x", "hi")

	// create an API token (account-scoped, via JWT)
	rec := postJSON(t, RequireAccount(CreateAPITokenHandler), "/api/v1/account/tokens", map[string]string{"scopes": "send"}, access)
	if rec.Code != http.StatusOK {
		t.Fatalf("create token: %d %s", rec.Code, rec.Body.String())
	}
	var tokResp struct{ ID, Token string }
	if err := json.Unmarshal(rec.Body.Bytes(), &tokResp); err != nil {
		t.Fatal(err)
	}
	if tokResp.Token == "" {
		t.Fatal("no raw token returned")
	}

	// the API token authenticates a sandbox route
	req := httptest.NewRequest("GET", "/api/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer "+tokResp.Token)
	req.Header.Set("X-Sandbox-ID", "sbx-x")
	rr := httptest.NewRecorder()
	RequireAuth(GetMessages)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("api-token access: %d %s", rr.Code, rr.Body.String())
	}
	var summ MessagesSummary
	_ = json.Unmarshal(rr.Body.Bytes(), &summ)
	if len(summ.Messages) != 1 {
		t.Fatalf("api-token sees %d messages, want 1", len(summ.Messages))
	}

	// team: create a member
	rec2 := postJSON(t, RequireAccount(CreateAccountUser), "/api/v1/account/users", map[string]string{"email": "member@x.com", "password": "pw2", "role": "member"}, access)
	if rec2.Code != http.StatusOK {
		t.Fatalf("create user: %d %s", rec2.Code, rec2.Body.String())
	}

	// list users includes owner + member
	lreq := httptest.NewRequest("GET", "/api/v1/account/users", nil)
	lreq.Header.Set("Authorization", "Bearer "+access)
	lrec := httptest.NewRecorder()
	RequireAccount(ListAccountUsers)(lrec, lreq)
	if lrec.Code != http.StatusOK {
		t.Fatalf("list users: %d", lrec.Code)
	}
	var users []map[string]any
	_ = json.Unmarshal(lrec.Body.Bytes(), &users)
	if len(users) < 2 {
		t.Fatalf("expected at least 2 users, got %d", len(users))
	}

	// subdomain resolution: Host subx.mail.test with no X-Sandbox-ID
	sreq := httptest.NewRequest("GET", "/api/v1/messages", nil)
	sreq.Host = "subx.mail.test"
	sreq.Header.Set("Authorization", "Bearer "+access)
	srec := httptest.NewRecorder()
	RequireAuth(GetMessages)(srec, sreq)
	if srec.Code != http.StatusOK {
		t.Fatalf("subdomain resolve: %d %s", srec.Code, srec.Body.String())
	}
	var summ2 MessagesSummary
	_ = json.Unmarshal(srec.Body.Bytes(), &summ2)
	if len(summ2.Messages) != 1 {
		t.Fatalf("subdomain resolve sees %d messages, want 1", len(summ2.Messages))
	}
}
