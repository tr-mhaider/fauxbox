package apiv1

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/shortuuid"
	"github.com/axllent/mailpit/internal/storage"
)

// requireAccountID returns the authenticated account, or writes an error and
// returns "" (these endpoints are multi-tenant only).
func requireAccountID(w http.ResponseWriter, r *http.Request) string {
	account := AccountFromRequest(r)
	if account == "" {
		httpError(w, "account management is only available in multi-tenant mode")
	}
	return account
}

// ListAccountUsers returns the members of the authenticated account.
func ListAccountUsers(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	users, err := storage.ListUsersByAccount(account)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	type userView struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	out := make([]userView, 0, len(users))
	for _, u := range users {
		out = append(out, userView{ID: u.ID, Email: u.Email, Role: u.Role})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// CreateAccountUser invites (creates) a user in the authenticated account.
func CreateAccountUser(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		httpError(w, "email and password are required")
		return
	}

	hash, err := identity.HashPassword(req.Password)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	id := shortuuid.New()
	if err := storage.CreateUser(id, account, req.Email, hash, req.Role); err != nil {
		httpError(w, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		ID string `json:"id"`
	}{ID: id})
}

// ListAPITokensHandler lists the account's API tokens (without secrets).
func ListAPITokensHandler(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	tokens, err := storage.ListAPITokens(account)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokens)
}

// CreateAPITokenHandler mints a new API token; the raw token is returned once.
func CreateAPITokenHandler(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	var req struct {
		Scopes string `json:"scopes"`
	}
	// body is optional
	_ = json.NewDecoder(r.Body).Decode(&req)

	id, raw, err := storage.CreateAPIToken(account, req.Scopes)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}{ID: id, Token: raw})
}

// DeleteAPITokenHandler revokes an API token by ID.
func DeleteAPITokenHandler(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	id := r.PathValue("id")
	if err := storage.DeleteAPIToken(account, id); err != nil {
		httpError(w, "token not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct{ OK bool }{OK: true})
}
