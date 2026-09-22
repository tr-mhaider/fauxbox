package identity

import (
	"testing"
	"time"
)

func TestPasswordHashing(t *testing.T) {
	hash, err := HashPassword("s3cret-pw")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "s3cret-pw" {
		t.Fatal("password stored in plaintext")
	}
	if !CheckPassword(hash, "s3cret-pw") {
		t.Fatal("correct password rejected")
	}
	if CheckPassword(hash, "wrong") {
		t.Fatal("wrong password accepted")
	}
}

func TestJWTRoundTrip(t *testing.T) {
	Configure("test-secret", time.Minute, time.Hour)

	tok, err := IssueAccessToken("user-1", "acc-1", 3)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	claims, err := ParseToken(tok)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.Subject != "user-1" || claims.Account != "acc-1" || claims.Version != 3 {
		t.Fatalf("claims mismatch: %+v", claims)
	}
	if claims.Refresh {
		t.Fatal("access token flagged as refresh")
	}
}

func TestJWTWrongSecretRejected(t *testing.T) {
	Configure("secret-a", time.Minute, time.Hour)
	tok, _ := IssueAccessToken("u", "a", 1)

	Configure("secret-b", time.Minute, time.Hour)
	if _, err := ParseToken(tok); err == nil {
		t.Fatal("token signed with a different secret was accepted")
	}
}

func TestJWTExpired(t *testing.T) {
	Configure("test-secret", -time.Minute, time.Hour) // negative kept as default, so force via issue
	// issue a token that is already expired by using a tiny positive TTL
	Configure("test-secret", time.Millisecond, time.Hour)
	tok, _ := IssueAccessToken("u", "a", 1)
	time.Sleep(5 * time.Millisecond)
	if _, err := ParseToken(tok); err == nil {
		t.Fatal("expired token was accepted")
	}
}
