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

func cookieByName(cookies []*http.Cookie, name string) *http.Cookie {
	for _, c := range cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
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

	// login sets httpOnly cookies and returns the account + CSRF token
	rec := postJSON(t, Login, "/api/v1/auth/login", map[string]string{"email": "bob@example.com", "password": "hunter2"}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login status %d: %s", rec.Code, rec.Body.String())
	}
	var lr loginResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &lr); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if lr.CSRFToken == "" || lr.AccountID != "acc-1" {
		t.Fatalf("unexpected login response: %+v", lr)
	}
	cookies := rec.Result().Cookies()
	at := cookieByName(cookies, cookieAccess)
	rt := cookieByName(cookies, cookieRefresh)
	csrf := cookieByName(cookies, cookieCSRF)
	if at == nil || rt == nil || csrf == nil {
		t.Fatal("login did not set all auth cookies")
	}

	// wrong password is rejected
	if rec := postJSON(t, Login, "/api/v1/auth/login", map[string]string{"email": "bob@example.com", "password": "nope"}, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password: expected 401, got %d", rec.Code)
	}

	// refresh via the refresh cookie
	rreq := httptest.NewRequest("POST", "/api/v1/auth/refresh", nil)
	rreq.AddCookie(rt)
	rrec := httptest.NewRecorder()
	Refresh(rrec, rreq)
	if rrec.Code != http.StatusOK {
		t.Fatalf("refresh status %d: %s", rrec.Code, rrec.Body.String())
	}

	// logout via cookie without CSRF is rejected
	noCSRF := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
	noCSRF.AddCookie(at)
	noRec := httptest.NewRecorder()
	Logout(noRec, noCSRF)
	if noRec.Code != http.StatusForbidden {
		t.Fatalf("logout without CSRF: expected 403, got %d", noRec.Code)
	}

	// logout with CSRF succeeds
	lreq := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
	lreq.AddCookie(at)
	lreq.AddCookie(csrf)
	lreq.Header.Set(csrfHeader, csrf.Value)
	lrec := httptest.NewRecorder()
	Logout(lrec, lreq)
	if lrec.Code != http.StatusOK {
		t.Fatalf("logout status %d: %s", lrec.Code, lrec.Body.String())
	}

	// the old refresh cookie is now revoked
	rreq2 := httptest.NewRequest("POST", "/api/v1/auth/refresh", nil)
	rreq2.AddCookie(rt)
	rrec2 := httptest.NewRecorder()
	Refresh(rrec2, rreq2)
	if rrec2.Code != http.StatusUnauthorized {
		t.Fatalf("revoked refresh: expected 401, got %d", rrec2.Code)
	}
}
