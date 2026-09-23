"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type { WebUIConfig } from "@/lib/types";

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ReleaseDialog({
  open,
  onClose,
  sandbox,
  messageId,
  defaultTo,
  relay,
}: {
  open: boolean;
  onClose: () => void;
  sandbox: string;
  messageId: string;
  defaultTo: string[];
  relay: WebUIConfig["MessageRelay"] | null;
}) {
  const { notify } = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the recipients to the message's own when the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setValue(defaultTo.join(", "));
      setError(null);
    }
  }, [open, defaultTo]);

  const enabled = relay?.Enabled ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const to = parseRecipients(value);
    if (to.length === 0) {
      setError("Enter at least one recipient.");
      return;
    }
    if (to.some((a) => !a.includes("@"))) {
      setError("Each recipient must be an email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.releaseMessage(sandbox, messageId, to);
      notify(`Released to ${to.length} recipient${to.length === 1 ? "" : "s"}`, "ok");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Release message"
      description={
        enabled
          ? `Relay this captured message through ${relay?.SMTPServer || "the configured SMTP server"}.`
          : undefined
      }
      footer={
        enabled ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} loading={busy}>
              <Send className="size-3.5" aria-hidden /> Release
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {enabled ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Recipients" htmlFor="release-to">
            <Input
              id="release-to"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              autoFocus
              mono
            />
          </Field>
          {(relay?.AllowedRecipients || relay?.BlockedRecipients) && (
            <div className="rounded-md border border-border bg-surface px-3 py-2 text-2xs text-muted">
              {relay?.AllowedRecipients && (
                <p>
                  Allowed recipients must match{" "}
                  <code className="font-mono text-faint">{relay.AllowedRecipients}</code>
                </p>
              )}
              {relay?.BlockedRecipients && (
                <p>
                  Blocked recipients match{" "}
                  <code className="font-mono text-faint">{relay.BlockedRecipients}</code>
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted">
          Message release is disabled on this server. It requires a configured SMTP relay.
        </p>
      )}
    </Dialog>
  );
}
