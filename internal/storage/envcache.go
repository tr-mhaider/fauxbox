package storage

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jhillyerd/enmime/v2"
)

const envelopeCacheTTL = 5 * time.Second

type envelopeCacheEntry struct {
	env     *enmime.Envelope
	rawSize uint64
	created time.Time
}

// envelopeCache provides a short-lived cache for parsed enmime envelopes.
// When a user opens a message with N image attachments, the browser fires
// N+1 concurrent requests (1 message + N thumbnails), each of which would
// otherwise trigger a full re-parse of the raw email. This cache ensures
// only one parse occurs per message, with a TTL of a few seconds to cover
// the burst and then free the memory.
var envelopeCache = struct {
	sync.Mutex
	entries  map[string]*envelopeCacheEntry
	inflight map[string]*envelopeInflight
}{
	entries:  make(map[string]*envelopeCacheEntry),
	inflight: make(map[string]*envelopeInflight),
}

type envelopeInflight struct {
	done chan struct{} // closed when parse completes
	env  *enmime.Envelope
	size uint64
	err  error
}

// getCachedEnvelope returns a parsed envelope for the given message ID,
// using the cache if available and deduplicating concurrent parses so
// only one goroutine does the actual work.
func getCachedEnvelope(ctx context.Context, id string) (*enmime.Envelope, uint64, error) {
	// key by sandbox scope + id so one sandbox's cached parse is never served
	// to another sandbox requesting the same (globally unique) message ID.
	key := scopeKey(ctx) + "\x00" + id

	envelopeCache.Lock()

	// check for a valid cached entry
	if entry, ok := envelopeCache.entries[key]; ok {
		if time.Since(entry.created) < envelopeCacheTTL {
			envelopeCache.Unlock()
			return entry.env, entry.rawSize, nil
		}
		delete(envelopeCache.entries, key)
	}

	// another goroutine is already parsing this message - wait for it
	if inf, ok := envelopeCache.inflight[key]; ok {
		envelopeCache.Unlock()
		<-inf.done
		return inf.env, inf.size, inf.err
	}

	// we are the first - register as inflight and release the lock
	inf := &envelopeInflight{done: make(chan struct{})}
	envelopeCache.inflight[key] = inf
	envelopeCache.Unlock()

	// ensure waiters are always unblocked, even on panic
	defer func() {
		if r := recover(); r != nil {
			inf.err = fmt.Errorf("panic parsing message %s: %v", id, r)
		}
		close(inf.done)

		envelopeCache.Lock()
		delete(envelopeCache.inflight, key)
		if inf.err == nil {
			envelopeCache.entries[key] = &envelopeCacheEntry{
				env:     inf.env,
				rawSize: inf.size,
				created: time.Now(),
			}
		}
		envelopeCache.Unlock()
	}()

	inf.env, inf.size, inf.err = parseEnvelope(ctx, id)

	return inf.env, inf.size, inf.err
}

// parseEnvelope fetches a raw message from the database and parses it with enmime.
func parseEnvelope(ctx context.Context, id string) (*enmime.Envelope, uint64, error) {
	raw, err := GetMessageRaw(ctx, id)
	if err != nil {
		return nil, 0, err
	}

	env, err := envelopeParser.ReadEnvelope(bytes.NewReader(raw))
	if err != nil {
		return nil, 0, err
	}

	return env, uint64(len(raw)), nil
}

// invalidateEnvelopeCache removes a specific message from the cache,
// e.g. when a message is deleted.
func invalidateEnvelopeCache(id string) {
	suffix := "\x00" + id
	envelopeCache.Lock()
	for k := range envelopeCache.entries {
		if k == id || strings.HasSuffix(k, suffix) {
			delete(envelopeCache.entries, k)
		}
	}
	envelopeCache.Unlock()
}

// invalidateAllEnvelopeCache clears the entire cache,
// e.g. when all messages are deleted.
func invalidateAllEnvelopeCache() {
	envelopeCache.Lock()
	envelopeCache.entries = make(map[string]*envelopeCacheEntry)
	envelopeCache.Unlock()
}
