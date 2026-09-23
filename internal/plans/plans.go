// Package plans defines the tenant plans the control plane provisions against.
// A plan sets both the account-level ceilings and the per-sandbox defaults; the
// data plane reads these off the rows live (Phase 5), so a plan change needs no
// redeploy. Limits use the codebase convention that 0 means unlimited.
package plans

// Plan is a named set of account and per-sandbox limits.
type Plan struct {
	Name string

	// Account-level ceilings.
	MaxMessages     int64
	MaxStorageBytes int64
	MaxSandboxes    int
	RateLimit       int

	// Per-sandbox defaults applied to each sandbox the account provisions.
	SandboxMaxMessages    int64
	SandboxMaxMessageSize int64
	SandboxRetentionHours int
	SandboxRateLimit      int
}

const (
	mb = 1 << 20
	gb = 1 << 30
)

var registry = map[string]Plan{
	"pilot": {
		Name:            "pilot",
		MaxMessages:     100_000,
		MaxStorageBytes: 5 * gb,
		MaxSandboxes:    10,
		RateLimit:       100,

		SandboxMaxMessages:    10_000,
		SandboxMaxMessageSize: 25 * mb,
		SandboxRetentionHours: 168, // 7 days
		SandboxRateLimit:      60,
	},
	"free": {
		Name:            "free",
		MaxMessages:     1_000,
		MaxStorageBytes: 200 * mb,
		MaxSandboxes:    1,
		RateLimit:       20,

		SandboxMaxMessages:    1_000,
		SandboxMaxMessageSize: 10 * mb,
		SandboxRetentionHours: 48,
		SandboxRateLimit:      20,
	},
}

// Get returns the named plan and whether it exists.
func Get(name string) (Plan, bool) {
	p, ok := registry[name]
	return p, ok
}
