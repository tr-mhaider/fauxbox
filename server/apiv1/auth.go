package apiv1

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

type authCtxKey int

const accountCtxKey authCtxKey = 0

const (
	cookieAccess  = "fauxbox_at"
	cookieRefresh = "fauxbox_rt"
	cookieCSRF    = "fauxbox_csrf"
	csrfHeader    = "X-CSRF-Token"
)

// AccountFromRequest returns the authenticated account ID, or "" if none.
func AccountFromRequest(r *http.Request) string {
	if a, ok := r.Context().Value(accountCtxKey).(string); ok {
		return a
	}
	return ""
}

// AccountFromToken resolves the account directly from the request's session
// cookie or bearer token, without relying on RequireAuth having run. The
// websocket handshake is not wrapped in the auth middleware, so it uses this.
func AccountFromToken(r *http.Request) string {
	acc, _, err := authAccount(r)
	if err != nil {
		return ""
	}
	return acc
}

func cookieSecure() bool { return config.UITLSCert != "" }

func setAuthCookies(w http.ResponseWriter, access, refresh, csrf string) {
	sec := cookieSecure()
	http.SetCookie(w, &http.Cookie{Name: cookieAccess, Value: access, Path: "/", HttpOnly: true, Secure: sec, SameSite: http.SameSiteLaxMode})
	http.SetCookie(w, &http.Cookie{Name: cookieRefresh, Value: refresh, Path: "/", HttpOnly: true, Secure: sec, SameSite: http.SameSiteLaxMode})
	// CSRF cookie is readable by JS (double-submit token).
	http.SetCookie(w, &http.Cookie{Name: cookieCSRF, Value: csrf, Path: "/", HttpOnly: false, Secure: sec, SameSite: http.SameSiteLaxMode})
}

func clearAuthCookies(w http.ResponseWriter) {
	for _, n := range []string{cookieAccess, cookieRefresh, cookieCSRF} {
		http.SetCookie(w, &http.Cookie{Name: n, Value: "", Path: "/", MaxAge: -1, HttpOnly: n != cookieCSRF})
	}
}

func newCSRFToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// accessTokenFromRequest returns the access token and whether it came from the
// session cookie (rather than the Authorization header).
func accessTokenFromRequest(r *http.Request) (string, bool) {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer "), false
	}
	if c, err := r.Cookie(cookieAccess); err == nil {
		return c.Value, true
	}
	return "", false
}

// csrfValid enforces the double-submit CSRF token for cookie-authenticated,
// state-changing requests. Safe methods and bearer requests are exempt.
func csrfValid(r *http.Request) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	c, err := r.Cookie(cookieCSRF)
	if err != nil || c.Value == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(r.Header.Get(csrfHeader))) == 1
}

// authAccount resolves the account ID for a request from either a user token
// (cookie or bearer, with a live TokenVersion check) or a programmatic API
// token. It also reports whether authentication came from the session cookie.
func authAccount(r *http.Request) (string, bool, error) {
	token, viaCookie := accessTokenFromRequest(r)
	if token == "" {
		return "", false, errors.New("missing token")
	}

	if claims, err := identity.ParseToken(token); err == nil && !claims.Refresh {
		if u, err := storage.GetUserByID(claims.Subject); err == nil && u.TokenVersion == claims.Version {
			return claims.Account, viaCookie, nil
		}
	}

	// API tokens are bearer-only
	if !viaCookie {
		if acc, _, err := storage.GetAPITokenAccount(token); err == nil {
			return acc, false, nil
		}
	}

	return "", false, errors.New("invalid token")
}

// firstHostLabel returns the first DNS label of a host (its subdomain), or ""
// for an IP or single-label host.
func firstHostLabel(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if net.ParseIP(host) != nil {
		return ""
	}
	i := strings.Index(host, ".")
	if i <= 0 {
		return ""
	}
	return host[:i]
}

// httpUnauthorized returns a 401 JSON error.
func httpUnauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(struct{ Error string }{Error: msg})
}

// httpForbidden returns a 403 JSON error.
func httpForbidden(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(struct{ Error string }{Error: msg})
}

// RequireAccount wraps an account-level handler (team, tokens). In single-tenant
// mode it passes through; in multi-tenant mode it authenticates and injects the
// account into the request context.
func RequireAccount(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !config.MultiTenant {
			next(w, r)
			return
		}
		acc, viaCookie, err := authAccount(r)
		if err != nil {
			httpUnauthorized(w, "authentication required")
			return
		}
		if viaCookie && !csrfValid(r) {
			httpForbidden(w, "invalid or missing CSRF token")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), accountCtxKey, acc)))
	}
}

// RequireAuth wraps a handler with sandbox authentication. In single-tenant mode
// it is a pass-through. In multi-tenant mode it validates the token (cookie or
// bearer), enforces CSRF for cookie-authenticated writes, resolves the sandbox
// from the X-Sandbox-ID header or the host subdomain, verifies the account owns
// it, and injects the sandbox into the request context.
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !config.MultiTenant {
			next(w, r)
			return
		}

		account, viaCookie, err := authAccount(r)
		if err != nil {
			httpUnauthorized(w, "authentication required")
			return
		}
		if viaCookie && !csrfValid(r) {
			httpForbidden(w, "invalid or missing CSRF token")
			return
		}

		// sandbox from the explicit header, else the request host's subdomain
		sandboxID := r.Header.Get("X-Sandbox-ID")
		if sandboxID == "" {
			if sub := firstHostLabel(r.Host); sub != "" {
				if sb, err := storage.GetSandboxBySubdomain(sub); err == nil {
					sandboxID = sb.ID
				}
			}
		}
		if sandboxID == "" {
			httpError(w, "missing sandbox (set the X-Sandbox-ID header or use a sandbox subdomain)")
			return
		}

		sb, err := storage.GetSandboxByID(sandboxID)
		if err != nil || sb.AccountID != account {
			httpForbidden(w, "sandbox not found or not permitted")
			return
		}

		ctx := context.WithValue(storage.WithSandbox(r.Context(), sandboxID), accountCtxKey, account)
		next(w, r.WithContext(ctx))
	}
}

// loginResponse is returned by login/refresh. Tokens live in httpOnly cookies;
// the body carries the account and the CSRF token the client echoes in headers.
type loginResponse struct {
	AccountID string `json:"account_id"`
	CSRFToken string `json:"csrf_token"`
}

// Login authenticates a user and sets httpOnly session cookies.
func Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body")
		return
	}

	u, err := storage.GetUserByEmail(strings.TrimSpace(req.Email))
	if err != nil || !identity.CheckPassword(u.PasswordHash, req.Password) {
		httpUnauthorized(w, "invalid email or password")
		return
	}

	access, err := identity.IssueAccessToken(u.ID, u.AccountID, u.TokenVersion)
	if err != nil {
		httpError(w, err.Error())
		return
	}
	refresh, err := identity.IssueRefreshToken(u.ID, u.AccountID, u.TokenVersion)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	csrf := newCSRFToken()
	setAuthCookies(w, access, refresh, csrf)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(loginResponse{AccountID: u.AccountID, CSRFToken: csrf})
}

// Refresh exchanges a valid refresh token (cookie or body) for a new access cookie.
func Refresh(w http.ResponseWriter, r *http.Request) {
	token := ""
	if c, err := r.Cookie(cookieRefresh); err == nil {
		token = c.Value
	}
	if token == "" {
		var req struct {
			RefreshToken string `json:"refresh_token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		token = req.RefreshToken
	}

	claims, err := identity.ParseToken(token)
	if err != nil || !claims.Refresh {
		httpUnauthorized(w, "invalid refresh token")
		return
	}

	u, err := storage.GetUserByID(claims.Subject)
	if err != nil || u.TokenVersion != claims.Version {
		httpUnauthorized(w, "refresh token revoked")
		return
	}

	access, err := identity.IssueAccessToken(u.ID, u.AccountID, u.TokenVersion)
	if err != nil {
		httpError(w, err.Error())
		return
	}
	refresh, err := identity.IssueRefreshToken(u.ID, u.AccountID, u.TokenVersion)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	csrf := newCSRFToken()
	setAuthCookies(w, access, refresh, csrf)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(loginResponse{AccountID: u.AccountID, CSRFToken: csrf})
}

// Logout bumps the user's TokenVersion (revoking all tokens) and clears cookies.
func Logout(w http.ResponseWriter, r *http.Request) {
	claims, viaCookie, err := userClaims(r)
	if err != nil {
		httpUnauthorized(w, "authentication required")
		return
	}
	if viaCookie && !csrfValid(r) {
		httpForbidden(w, "invalid or missing CSRF token")
		return
	}

	if err := storage.BumpTokenVersion(claims.Subject); err != nil {
		httpError(w, err.Error())
		return
	}

	clearAuthCookies(w)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct{ OK bool }{OK: true})
}

// userClaims validates the access token (cookie or bearer) and re-checks the
// TokenVersion against the DB so a revoked token is rejected. It reports whether
// the token came from the session cookie.
func userClaims(r *http.Request) (*identity.Claims, bool, error) {
	token, viaCookie := accessTokenFromRequest(r)
	if token == "" {
		return nil, false, errors.New("missing token")
	}

	claims, err := identity.ParseToken(token)
	if err != nil {
		return nil, viaCookie, err
	}
	if claims.Refresh {
		return nil, viaCookie, errors.New("refresh token used as access token")
	}

	u, err := storage.GetUserByID(claims.Subject)
	if err != nil || u.TokenVersion != claims.Version {
		return nil, viaCookie, errors.New("token revoked")
	}

	return claims, viaCookie, nil
}
