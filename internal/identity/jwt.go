package identity

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	secret     []byte
	accessTTL  = 15 * time.Minute
	refreshTTL = 30 * 24 * time.Hour

	// ErrInvalidToken is returned when a token fails to parse or validate.
	ErrInvalidToken = errors.New("invalid token")
)

// Configure sets the JWT signing secret and token lifetimes. Non-positive
// durations keep the defaults (15m access, 30d refresh).
func Configure(jwtSecret string, access, refresh time.Duration) {
	secret = []byte(jwtSecret)
	if access > 0 {
		accessTTL = access
	}
	if refresh > 0 {
		refreshTTL = refresh
	}
}

// Claims is the JWT payload. Version mirrors the user's TokenVersion so a bump
// invalidates every previously issued token for that user.
type Claims struct {
	Account string `json:"acc"`
	Version int    `json:"ver"`
	Refresh bool   `json:"rt,omitempty"`
	jwt.RegisteredClaims
}

// IssueAccessToken returns a short-lived access token for a user.
func IssueAccessToken(userID, accountID string, version int) (string, error) {
	return issue(userID, accountID, version, false, accessTTL)
}

// IssueRefreshToken returns a long-lived refresh token for a user.
func IssueRefreshToken(userID, accountID string, version int) (string, error) {
	return issue(userID, accountID, version, true, refreshTTL)
}

func issue(userID, accountID string, version int, refresh bool, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Account: accountID,
		Version: version,
		Refresh: refresh,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// ParseToken validates a token's signature and expiry and returns its claims.
func ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return secret, nil
	})
	if err != nil || !tok.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
