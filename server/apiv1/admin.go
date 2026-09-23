package apiv1

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/storage"
)

// RequireAdmin guards the control-plane provisioning endpoints with a static
// bearer token (config.AdminToken). When no token is configured the endpoints
// are disabled entirely.
func RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if config.AdminToken == "" {
			http.Error(w, "admin API is disabled", http.StatusNotFound)
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if subtle.ConstantTimeCompare([]byte(token), []byte(config.AdminToken)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func adminError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(struct {
		Error string `json:"error"`
	}{Error: msg})
}

func randomPassword() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// ProvisionAccount (POST /api/v1/admin/provision) creates an account, its
// sandboxes with generated SMTP credentials, and the first owner user. If no
// password is supplied one is generated and returned once.
func ProvisionAccountHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Plan       string   `json:"plan"`
		Email      string   `json:"email"`
		Password   string   `json:"password"`
		Subdomain  string   `json:"subdomain"`
		Subdomains []string `json:"subdomains"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		adminError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	subdomains := req.Subdomains
	if req.Subdomain != "" {
		subdomains = append(subdomains, req.Subdomain)
	}
	if req.Plan == "" || req.Email == "" || len(subdomains) == 0 {
		adminError(w, "plan, email, and at least one subdomain are required", http.StatusBadRequest)
		return
	}

	password := req.Password
	generated := ""
	if password == "" {
		p, err := randomPassword()
		if err != nil {
			adminError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		password, generated = p, p
	}

	hash, err := identity.HashPassword(password)
	if err != nil {
		adminError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := storage.ProvisionAccount(req.Plan, strings.TrimSpace(req.Email), hash, subdomains)
	if err != nil {
		adminError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(struct {
		*storage.ProvisionResult
		GeneratedPassword string `json:"generated_password,omitempty"`
	}{ProvisionResult: result, GeneratedPassword: generated})
}

// SetAccountPlanHandler (PUT /api/v1/admin/accounts/{id}/plan) changes an
// account's plan; the data plane reads the new limits live.
func SetAccountPlanHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Plan string `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Plan == "" {
		adminError(w, "plan is required", http.StatusBadRequest)
		return
	}
	if err := storage.SetAccountPlan(id, req.Plan); err != nil {
		adminError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		OK bool `json:"ok"`
	}{OK: true})
}

// CancelAccountHandler (POST /api/v1/admin/accounts/{id}/cancel) downgrades the
// account and forces every user in it to re-authenticate.
func CancelAccountHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := storage.CancelAccount(id); err != nil {
		adminError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		OK bool `json:"ok"`
	}{OK: true})
}
