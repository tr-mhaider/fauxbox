package storage

import (
	"context"
	"testing"
	"time"
)

// TestEventBus proves an event published via NOTIFY is delivered to a LISTEN
// consumer (the cross-node realtime path, exercised within one process).
func TestEventBus(t *testing.T) {
	setup("")
	defer Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	got := make(chan SandboxEvent, 1)
	go StartEventListener(ctx, func(ev SandboxEvent) { got <- ev })

	// give the listener a moment to establish LISTEN
	time.Sleep(300 * time.Millisecond)

	NotifyEvent("sb-x", "new", "msg-1")

	select {
	case ev := <-got:
		if ev.Sandbox != "sb-x" || ev.Type != "new" || ev.ID != "msg-1" {
			t.Fatalf("unexpected event: %+v", ev)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for event")
	}
}
