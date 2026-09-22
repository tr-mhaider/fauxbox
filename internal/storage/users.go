package storage

import (
	"time"
)

// Account and User records live in the control-plane tables, which are not
// under Row-Level Security, so these functions use the connection pool directly.

// Account is a billing/grouping tenant that owns users and sandboxes.
type Account struct {
	ID   string
	Plan string
}

// User is a member of an account who can sign in to the dashboard.
type User struct {
	ID           string
	AccountID    string
	Email        string
	PasswordHash string
	Role         string
	TokenVersion int
}

// CreateAccount inserts an account, ignoring duplicates.
func CreateAccount(id, plan string) error {
	if plan == "" {
		plan = "default"
	}
	_, err := db.Exec(`INSERT INTO `+tenant("accounts")+` (ID, Plan, Created) VALUES ($1, $2, $3) ON CONFLICT (ID) DO NOTHING`,
		id, plan, time.Now().UnixMilli())
	return err
}

// CreateUser inserts a user with TokenVersion 1.
func CreateUser(id, accountID, email, passwordHash, role string) error {
	if role == "" {
		role = "member"
	}
	_, err := db.Exec(`INSERT INTO `+tenant("users")+` (ID, AccountID, Email, PasswordHash, Role, TokenVersion, Created) VALUES ($1, $2, $3, $4, $5, 1, $6)`,
		id, accountID, email, passwordHash, role, time.Now().UnixMilli())
	return err
}

// GetUserByEmail returns a user by email (case-insensitive via citext).
func GetUserByEmail(email string) (*User, error) {
	u := &User{}
	err := db.QueryRow(`SELECT ID, AccountID, Email, PasswordHash, Role, TokenVersion FROM `+tenant("users")+` WHERE Email = $1`, email).
		Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Role, &u.TokenVersion)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetUserByID returns a user by ID.
func GetUserByID(id string) (*User, error) {
	u := &User{}
	err := db.QueryRow(`SELECT ID, AccountID, Email, PasswordHash, Role, TokenVersion FROM `+tenant("users")+` WHERE ID = $1`, id).
		Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Role, &u.TokenVersion)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// BumpTokenVersion increments a user's TokenVersion, invalidating all previously
// issued access/refresh tokens for that user (logout, password change, billing).
func BumpTokenVersion(id string) error {
	_, err := db.Exec(`UPDATE `+tenant("users")+` SET TokenVersion = TokenVersion + 1 WHERE ID = $1`, id)
	return err
}

// ListUsersByAccount returns the members of an account (without password hashes).
func ListUsersByAccount(accountID string) ([]User, error) {
	rows, err := db.Query(`SELECT ID, AccountID, Email, Role, TokenVersion FROM `+tenant("users")+` WHERE AccountID = $1 ORDER BY Email`, accountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.AccountID, &u.Email, &u.Role, &u.TokenVersion); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}
