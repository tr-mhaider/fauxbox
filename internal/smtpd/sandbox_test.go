package smtpd

import (
	"context"
	"net"
	"os"
	"testing"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/internal/identity"
	"github.com/axllent/mailpit/internal/logger"
	"github.com/axllent/mailpit/internal/storage"
)

func TestMultiTenantSMTP(t *testing.T) {
	logger.NoLogging = true
	config.Database = os.Getenv("MP_DATABASE")
	config.MaxMessages = 0
	config.TenantID = ""
	if err := storage.InitDB(); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	defer storage.Close()
	if err := storage.DeleteAllMessages(storage.WithBypass(context.Background())); err != nil {
		t.Fatalf("DeleteAllMessages: %v", err)
	}

	config.MultiTenant = true
	t.Cleanup(func() { config.MultiTenant = false })
	identity.Configure("test-secret", 0, 0)

	if err := storage.CreateAccount("acc-s", "pro"); err != nil {
		t.Fatal(err)
	}
	if err := storage.CreateSandbox("sb-s", "acc-s", "envs"); err != nil {
		t.Fatal(err)
	}
	hash, _ := identity.HashPassword("smtp-pw")
	if err := storage.SetSandboxSMTP("sb-s", "envs-user", hash); err != nil {
		t.Fatal(err)
	}

	origin := &net.TCPAddr{IP: net.ParseIP("127.0.0.1")}

	// SMTP auth against sandbox credentials
	if ok, _ := mtAuthHandler(origin, "PLAIN", []byte("envs-user"), []byte("smtp-pw"), nil); !ok {
		t.Fatal("valid SMTP credentials rejected")
	}
	if bad, _ := mtAuthHandler(origin, "PLAIN", []byte("envs-user"), []byte("wrong"), nil); bad {
		t.Fatal("wrong SMTP password accepted")
	}

	user := "envs-user"

	// recipient on the sandbox's subdomain is accepted and stored in that sandbox
	raw := []byte("From: a@example.test\r\nTo: box@envs.mail.test\r\nSubject: hi\r\n\r\nbody\r\n")
	if _, err := mailHandler(origin, "a@example.test", []string{"box@envs.mail.test"}, raw, &user); err != nil {
		t.Fatalf("valid recipient rejected: %v", err)
	}

	msgs, err := storage.List(storage.WithSandbox(context.Background(), "sb-s"), 0, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 1 {
		t.Fatalf("sandbox sb-s has %d messages, want 1", len(msgs))
	}

	// a recipient on another subdomain is rejected (cross-tenant)
	raw2 := []byte("From: a@example.test\r\nTo: box@other.mail.test\r\nSubject: hi\r\n\r\nbody\r\n")
	if _, err := mailHandler(origin, "a@example.test", []string{"box@other.mail.test"}, raw2, &user); err == nil {
		t.Fatal("cross-tenant recipient was accepted")
	}

	// unknown SMTP user is rejected
	unknown := "nobody"
	if _, err := mailHandler(origin, "a@example.test", []string{"box@envs.mail.test"}, raw, &unknown); err == nil {
		t.Fatal("unknown sandbox credentials accepted")
	}
}
