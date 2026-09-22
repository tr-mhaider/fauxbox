package storage

import (
	"context"
	"time"
)

// PruneSandbox enforces a single sandbox's limits: keep at most maxMessages
// (newest first) and delete anything older than retentionHours. Zero disables
// that check. Returns the number of messages pruned.
func PruneSandbox(sandboxID string, maxMessages int64, retentionHours int) (int, error) {
	ids, err := sandboxPruneIDs(sandboxID, maxMessages, retentionHours)
	if err != nil || len(ids) == 0 {
		return 0, err
	}
	// Delete scoped to the sandbox (RLS double-checks the ids belong to it).
	if err := DeleteMessages(WithSandbox(context.Background(), sandboxID), ids); err != nil {
		return 0, err
	}
	return len(ids), nil
}

// PruneAccount enforces an account's aggregate limits across its sandboxes:
// at most maxMessages and at most maxStorageBytes (by raw message size), newest
// first. Zero disables that check. Returns the number of messages pruned.
func PruneAccount(accountID string, maxMessages, maxStorageBytes int64) (int, error) {
	ids, err := accountPruneIDs(accountID, maxMessages, maxStorageBytes)
	if err != nil || len(ids) == 0 {
		return 0, err
	}
	// Cross-sandbox deletion by id: run as owner (bypass), ids already scoped
	// to this account.
	if err := DeleteMessages(WithBypass(context.Background()), ids); err != nil {
		return 0, err
	}
	return len(ids), nil
}

// sandboxPruneIDs collects the message ids to prune for a sandbox.
func sandboxPruneIDs(sandboxID string, maxMessages int64, retentionHours int) ([]string, error) {
	seen := map[string]bool{}
	ids := []string{}

	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}

	if maxMessages > 0 {
		rows, err := db.Query(`SELECT ID FROM `+tenant("mailbox")+` WHERE SandboxID = $1 ORDER BY Created DESC OFFSET $2`, sandboxID, maxMessages)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return nil, err
			}
			add(id)
		}
		_ = rows.Close()
	}

	if retentionHours > 0 {
		ts := time.Now().Add(-time.Duration(retentionHours) * time.Hour).UnixMilli()
		rows, err := db.Query(`SELECT ID FROM `+tenant("mailbox")+` WHERE SandboxID = $1 AND Created < $2`, sandboxID, ts)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return nil, err
			}
			add(id)
		}
		_ = rows.Close()
	}

	return ids, nil
}

// accountPruneIDs collects the message ids to prune for an account.
func accountPruneIDs(accountID string, maxMessages, maxStorageBytes int64) ([]string, error) {
	seen := map[string]bool{}
	ids := []string{}

	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}

	if maxMessages > 0 {
		rows, err := db.Query(`SELECT m.ID FROM `+tenant("mailbox")+` m JOIN `+tenant("sandboxes")+` s ON m.SandboxID = s.ID WHERE s.AccountID = $1 ORDER BY m.Created DESC OFFSET $2`, accountID, maxMessages)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return nil, err
			}
			add(id)
		}
		_ = rows.Close()
	}

	if maxStorageBytes > 0 {
		rows, err := db.Query(`SELECT m.ID, m.Size FROM `+tenant("mailbox")+` m JOIN `+tenant("sandboxes")+` s ON m.SandboxID = s.ID WHERE s.AccountID = $1 ORDER BY m.Created DESC`, accountID)
		if err != nil {
			return nil, err
		}
		var running int64
		for rows.Next() {
			var id string
			var size float64
			if err := rows.Scan(&id, &size); err != nil {
				_ = rows.Close()
				return nil, err
			}
			running += int64(size)
			if running > maxStorageBytes {
				add(id)
			}
		}
		_ = rows.Close()
	}

	return ids, nil
}
