package storage

import "testing"

func TestUserCRUD(t *testing.T) {
	setup("")
	defer Close()

	if err := CreateAccount("acc-test", "pro"); err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if err := CreateUser("usr-test", "acc-test", "Alice@Example.com", "hash", "owner"); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	// citext email lookup is case-insensitive
	u, err := GetUserByEmail("alice@example.com")
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if u.ID != "usr-test" || u.AccountID != "acc-test" || u.TokenVersion != 1 {
		t.Fatalf("unexpected user: %+v", u)
	}

	if err := BumpTokenVersion("usr-test"); err != nil {
		t.Fatalf("BumpTokenVersion: %v", err)
	}
	u2, err := GetUserByID("usr-test")
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if u2.TokenVersion != 2 {
		t.Fatalf("token version not bumped: %d", u2.TokenVersion)
	}
}
