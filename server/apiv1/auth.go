package apiv1

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

// tokenResponse is returned by login and refresh.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	AccountID    string `json:"account_id"`
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

// RequireAuth wraps a handler with sandbox authentication. In single-tenant mode
// it is a pass-through. In multi-tenant mode it validates the bearer token,
// resolves the sandbox from the X-Sandbox-ID header, verifies the token's account
// owns that sandbox, and injects the sandbox into the request context so storage
// calls made by the handler are scoped (and enforced by Row-Level Security).
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !config.MultiTenant {
			next(w, r)
			return
		}

		claims, err := bearerClaims(r)
		if err != nil {
			httpUnauthorized(w, "authentication required")
			return
		}

		sandboxID := r.Header.Get("X-Sandbox-ID")
		if sandboxID == "" {
			httpError(w, "missing X-Sandbox-ID header")
			return
		}

		sb, err := storage.GetSandboxByID(sandboxID)
		if err != nil || sb.AccountID != claims.Account {
			httpForbidden(w, "sandbox not found or not permitted")
			return
		}

		next(w, r.WithContext(storage.WithSandbox(r.Context(), sandboxID)))
	}
}

// Login authenticates a user by email and password and returns tokens.
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
		// same response whether the user exists or the password is wrong
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokenResponse{AccessToken: access, RefreshToken: refresh, AccountID: u.AccountID})
}

// Refresh exchanges a valid refresh token for a new access token.
func Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body")
		return
	}

	claims, err := identity.ParseToken(req.RefreshToken)
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokenResponse{AccessToken: access, AccountID: u.AccountID})
}

// Logout bumps the user's TokenVersion, invalidating all their existing tokens.
func Logout(w http.ResponseWriter, r *http.Request) {
	claims, err := bearerClaims(r)
	if err != nil {
		httpUnauthorized(w, "authentication required")
		return
	}

	if err := storage.BumpTokenVersion(claims.Subject); err != nil {
		httpError(w, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct{ OK bool }{OK: true})
}

// bearerClaims extracts and fully validates the access token from the
// Authorization header, including checking the TokenVersion against the DB so a
// revoked (bumped) token is rejected immediately.
func bearerClaims(r *http.Request) (*identity.Claims, error) {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return nil, errors.New("missing bearer token")
	}

	claims, err := identity.ParseToken(strings.TrimPrefix(h, "Bearer "))
	if err != nil {
		return nil, err
	}
	if claims.Refresh {
		return nil, errors.New("refresh token used as access token")
	}

	u, err := storage.GetUserByID(claims.Subject)
	if err != nil || u.TokenVersion != claims.Version {
		return nil, errors.New("token revoked")
	}

	return claims, nil
}
