package storage

import (
	"context"
	"time"

	"github.com/axllent/mailpit/config"
	"github.com/axllent/mailpit/server/websockets"
)

// broadcastScoped sends a websocket event to the clients watching the sandbox
// in ctx. With a bypass or single-tenant scope it falls back to a global
// broadcast (every client). This is what keeps one tenant's mail events from
// reaching another tenant's open UI.
func broadcastScoped(ctx context.Context, t string, msg any) {
	s := scopeFromCtx(ctx)
	if s.bypass || s.sandboxID == "" {
		websockets.Broadcast(t, msg)
		return
	}
	websockets.BroadcastToSandbox(s.sandboxID, t, msg)
}

var bcStatsDelay = false

// BroadcastMailboxStats broadcasts the total number of messages
// displayed to the web UI, as well as the total unread messages.
// The lookup is very fast (< 10ms / 100k messages under load).
// Rate limited to 4x per second.
func BroadcastMailboxStats() {
	if bcStatsDelay {
		return
	}

	bcStatsDelay = true

	go func() {
		time.Sleep(250 * time.Millisecond)
		bcStatsDelay = false
		// This is a single global websocket broadcast (not per-sandbox), so it
		// reports global counts via a bypass scope. ponytail: per-sandbox realtime
		// stats would need the broadcast itself scoped per subscriber (Phase 6/11).
		ctx := WithBypass(context.Background())
		b := struct {
			Total   uint64
			Unread  uint64
			Version string
		}{
			Total:   CountTotal(ctx),
			Unread:  CountUnread(ctx),
			Version: config.Version,
		}

		websockets.Broadcast("stats", b)
	}()
}
