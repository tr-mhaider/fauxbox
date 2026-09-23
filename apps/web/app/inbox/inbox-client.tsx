"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showNewMail } from "@/lib/notifications";
import { Inbox as InboxIcon, MailOpen, Mail, Tag as TagIcon, Trash2, X } from "lucide-react";
import { MessageRow } from "@/components/inbox/message-row";
import { MessageViewer } from "@/components/inbox/message-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useSearch } from "@/lib/search";
import { useEvents } from "@/lib/use-events";
import { toItem, type MessageItem } from "@/lib/view-model";
import { cn } from "@/lib/cn";

export function InboxClient() {
  const { activeSandbox } = useSession();
  const sandboxId = activeSandbox?.id ?? null;
  const { query, setQuery } = useSearch();
  const { notify } = useToast();

  const [items, setItems] = useState<MessageItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [tagValue, setTagValue] = useState("");

  // Top message id from the last load, to detect genuinely new mail for
  // notifications (scoped to the active sandbox, unlike the global socket event).
  const prevTopId = useRef<string | null>(null);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!sandboxId) return;
      const q = query.trim();
      setLoading(true);
      setError(null);
      const req = q
        ? api.search(sandboxId, q, 0, 50, signal)
        : api.getMessages(sandboxId, 0, 50, signal);
      req
        .then((res) => {
          const next = res.messages.map(toItem);
          // A new top message (that wasn't there last load) means fresh mail in
          // this sandbox — safe to notify with its content.
          const top = next[0];
          if (prevTopId.current !== null && top && top.id !== prevTopId.current && top.unread) {
            showNewMail(`New message: ${top.subject}`, `From ${top.fromName}`);
          }
          prevTopId.current = top ? top.id : null;
          setItems(next);
          setUnread(res.messages_unread);
          setTotal(res.messages_count);
          // Drop any selection for messages that no longer exist.
          setChecked((prev) => {
            const ids = new Set(next.map((m) => m.id));
            const kept = [...prev].filter((id) => ids.has(id));
            return kept.length === prev.size ? prev : new Set(kept);
          });
          setLoading(false);
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setError(e instanceof Error ? e.message : "Failed to load messages");
          setLoading(false);
        });
    },
    [sandboxId, query],
  );

  // Clear the search when switching sandboxes so results don't carry over.
  useEffect(() => {
    setQuery("");
  }, [sandboxId, setQuery]);

  // Reload on sandbox switch or query change; drop stale selection/open state.
  useEffect(() => {
    setSelectedId(null);
    setChecked(new Set());
    prevTopId.current = null; // don't notify for the first load after a switch
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Reflect the unread count in the tab title (carried over from the old UI).
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Fauxbox` : "Fauxbox";
    return () => {
      document.title = "Fauxbox";
    };
  }, [unread]);

  useEvents(sandboxId, (n) => {
    if (n.Type === "new" || n.Type === "delete" || n.Type === "truncate" || n.Type === "update") {
      load();
    }
  });

  const selected = items.find((m) => m.id === selectedId) ?? null;
  const checkedIds = [...checked];
  const allChecked = items.length > 0 && checked.size === items.length;

  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => (prev.size === items.length ? new Set() : new Set(items.map((m) => m.id))));
  }

  function clearSelection() {
    setChecked(new Set());
    setTagging(false);
    setTagValue("");
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!sandboxId || checkedIds.length === 0) return;
    setBusy(true);
    try {
      await fn();
      notify(label, "ok");
      clearSelection();
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const markRead = (read: boolean) =>
    run(`Marked ${checkedIds.length} ${read ? "read" : "unread"}`, () =>
      api.setRead(sandboxId!, checkedIds, read),
    );

  async function doDelete() {
    const ids = new Set(checkedIds);
    await run(`Deleted ${checkedIds.length}`, () => api.deleteMessages(sandboxId!, checkedIds));
    setConfirmDelete(false);
    if (selectedId && ids.has(selectedId)) setSelectedId(null);
  }

  function applyTag() {
    const tag = tagValue.trim();
    if (!tag) return;
    const targets = items.filter((m) => checked.has(m.id));
    run(`Tagged ${targets.length} with #${tag}`, () =>
      // The tags endpoint overwrites per message, so union each message's
      // existing tags with the new one to avoid clobbering.
      Promise.all(
        targets.map((m) => api.setMessageTags(sandboxId!, m.id, [...new Set([...m.tags, tag])])),
      ),
    );
  }

  const hasSelection = checked.size > 0;

  return (
    <div className="flex h-full min-h-0">
      <section
        className={cn(
          "flex w-full flex-col border-r border-border md:w-[26rem] md:shrink-0",
          selected && "hidden md:flex",
        )}
      >
        {/* Header morphs into a bulk-action bar when messages are selected. */}
        <div className="border-b border-border">
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = hasSelection && !allChecked;
              }}
              onChange={toggleAll}
              disabled={items.length === 0}
              aria-label={allChecked ? "Deselect all" : "Select all"}
              className="size-3.5 cursor-pointer rounded border-border-strong disabled:opacity-40"
              style={{ accentColor: "var(--accent)" }}
            />
            {hasSelection ? (
              <>
                <span className="text-xs font-medium text-fg">{checked.size} selected</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => markRead(true)}>
                    <MailOpen className="size-3.5" aria-hidden /> Read
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => markRead(false)}>
                    <Mail className="size-3.5" aria-hidden /> Unread
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setTagging((v) => !v)}
                    aria-expanded={tagging}
                  >
                    <TagIcon className="size-3.5" aria-hidden /> Tag
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Delete selected"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </>
            ) : searching ? (
              <>
                <span className="min-w-0 truncate text-xs font-medium text-muted">
                  {total} result{total === 1 ? "" : "s"}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-faint">{trimmed}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery("")}
                  className="ml-auto"
                >
                  <X className="size-3.5" aria-hidden /> Clear
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-muted">Capture stream</span>
                <Badge status="ok" mono className="ml-auto">
                  {unread} new
                </Badge>
              </>
            )}
          </div>

          {hasSelection && tagging && (
            <form
              className="flex items-center gap-2 border-t border-border px-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyTag();
              }}
            >
              <Input
                autoFocus
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                placeholder="tag name"
                aria-label="Tag name"
                mono
                className="h-8"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={busy || !tagValue.trim()}>
                Add
              </Button>
            </form>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading && items.length === 0 && (
            <p className="p-4 text-xs text-muted">Loading capture stream…</p>
          )}
          {error && <p className="p-4 text-xs text-error">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="p-4 text-xs text-faint">
              {searching
                ? "No messages match this search."
                : "No messages captured in this sandbox yet."}
            </p>
          )}
          {items.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              selected={m.id === selectedId}
              checked={checked.has(m.id)}
              onSelect={() => setSelectedId(m.id)}
              onToggleCheck={() => toggleOne(m.id)}
            />
          ))}
        </div>
      </section>

      <section className={cn("min-w-0 flex-1", !selected && "hidden md:block")}>
        {selected && sandboxId ? (
          <MessageViewer item={selected} sandbox={sandboxId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3">
              <span className="grid size-12 place-items-center rounded-lg border border-border bg-surface text-faint">
                <InboxIcon className="size-6" aria-hidden />
              </span>
              <p className="text-sm font-medium text-fg">No message selected</p>
              <p className="text-xs text-muted">
                Pick a captured signal from the stream to inspect its content, headers, and raw source.
              </p>
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete messages"
        description={`Permanently delete ${checked.size} message${checked.size === 1 ? "" : "s"} from this sandbox? This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={doDelete} loading={busy}>
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
