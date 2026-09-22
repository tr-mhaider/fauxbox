package apiv1

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

func postJSON(t *testing.T, fn http.HandlerFunc, path string, body any, auth string) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", path, bytes.NewReader(b))
	if auth != "" {
		req.Header.Set("Authorization", "Bearer "+auth)
	}
	rec := httptest.NewRecorder()
	fn(rec, req)
	return rec
}

func TestAuthFlow(t *testing.T) {
	initTestDB(t)
	identity.Configure("test-secret", 0, 0)

	hash, _ := identity.HashPassword("hunter2")
	if err := storage.CreateAccount("acc-1", "pro"); err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if err := storage.CreateUser("usr-1", "acc-1", "bob@example.com", hash, "owner"); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	// login succeeds and returns tokens
	rec := postJSON(t, Login, "/api/v1/auth/login", map[string]string{"email": "bob@example.com", "password": "hunter2"}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login status %d: %s", rec.Code, rec.Body.String())
	}
	var tok tokenResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &tok); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if tok.AccessToken == "" || tok.RefreshToken == "" || tok.AccountID != "acc-1" {
		t.Fatalf("unexpected token response: %+v", tok)
	}

	// wrong password is rejected
	if rec := postJSON(t, Login, "/api/v1/auth/login", map[string]string{"email": "bob@example.com", "password": "nope"}, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password: expected 401, got %d", rec.Code)
	}

	// refresh works
	if rec := postJSON(t, Refresh, "/api/v1/auth/refresh", map[string]string{"refresh_token": tok.RefreshToken}, ""); rec.Code != http.StatusOK {
		t.Fatalf("refresh status %d: %s", rec.Code, rec.Body.String())
	}

	// logout bumps the token version
	if rec := postJSON(t, Logout, "/api/v1/auth/logout", nil, tok.AccessToken); rec.Code != http.StatusOK {
		t.Fatalf("logout status %d: %s", rec.Code, rec.Body.String())
	}

	// the old refresh token is now revoked
	if rec := postJSON(t, Refresh, "/api/v1/auth/refresh", map[string]string{"refresh_token": tok.RefreshToken}, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked refresh: expected 401, got %d", rec.Code)
	}
}
