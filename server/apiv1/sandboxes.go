package apiv1

import (
	"encoding/json"
	"net/http"

	"github.com/axllent/mailpit/internal/storage"
)

// ListSandboxes returns the sandboxes owned by the authenticated account. It
// backs the web UI's sandbox switcher; per-sandbox limits are read-only here.
func ListSandboxes(w http.ResponseWriter, r *http.Request) {
	account := requireAccountID(w, r)
	if account == "" {
		return
	}

	sandboxes, err := storage.SandboxesByAccount(account)
	if err != nil {
		httpError(w, err.Error())
		return
	}

	type sandboxView struct {
		ID             string `json:"id"`
		Subdomain      string `json:"subdomain"`
		SMTPUsername   string `json:"smtp_username"`
		MaxMessages    int64  `json:"max_messages"`
		MaxMessageSize int64  `json:"max_message_size"`
		RetentionHours int    `json:"retention_hours"`
		RateLimit      int    `json:"rate_limit"`
		WebhookURL     string `json:"webhook_url"`
	}
	out := make([]sandboxView, 0, len(sandboxes))
	for _, s := range sandboxes {
		out = append(out, sandboxView{
			ID:             s.ID,
			Subdomain:      s.Subdomain,
			SMTPUsername:   s.SMTPUsername,
			MaxMessages:    s.MaxMessages,
			MaxMessageSize: s.MaxMessageSize,
			RetentionHours: s.RetentionHours,
			RateLimit:      s.RateLimit,
			WebhookURL:     s.WebhookURL,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}
