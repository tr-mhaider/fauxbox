"use client";

import { useEffect, useState } from "react";
import { Download, Send, Trash2, Tag as TagIcon, ArrowLeft } from "lucide-react";
import { Tabs, tabId, panelId, type TabItem } from "@/components/ui/tabs";
import { KeyValueTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useWebUIConfig } from "@/lib/webui";
import { ReleaseDialog } from "./release-dialog";
import { HtmlCheckPanel, LinkCheckPanel, SpamCheckPanel } from "./check-panels";
import { AttachmentsPanel } from "./attachments-panel";
import type { Message } from "@/lib/types";
import type { MessageItem } from "@/lib/view-model";
import { formatSize } from "@/lib/view-model";
import { tagColor } from "@/lib/tag-color";

const CONTENT_TABS = ["preview", "html", "text", "headers", "attachments"];

function addrLine(list: Message["To"]): string {
  if (!list || list.length === 0) return "";
  return list.map((a) => (a.Name ? `${a.Name} <${a.Address}>` : a.Address)).join(", ");
}

export function MessageViewer({
  item,
  sandbox,
  onBack,
}: {
  item: MessageItem;
  sandbox: string;
  onBack?: () => void;
}) {
  const [tab, setTab] = useState("preview");
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const { notify } = useToast();
  const webui = useWebUIConfig();

  const attachmentCount =
    (message?.Attachments?.length ?? 0) + (message?.Inline?.length ?? 0) || item.attachments;

  const tabs: TabItem[] = [
    { id: "preview", label: "Preview" },
    { id: "html", label: "HTML" },
    { id: "text", label: "Text" },
    { id: "headers", label: "Headers" },
    ...(attachmentCount > 0 ? [{ id: "attachments", label: "Attachments", count: attachmentCount }] : []),
    { id: "htmlcheck", label: "HTML check" },
    { id: "links", label: "Links" },
    ...(webui?.SpamAssassin ? [{ id: "spam", label: "Spam" }] : []),
  ];

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    setError(null);
    const ctrl = new AbortController();
    api
      .getMessage(sandbox, item.id, ctrl.signal)
      .then((m) => !cancelled && setMessage(m))
      .catch((e) => {
        if (cancelled || e?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load message");
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [sandbox, item.id]);

  const headers = message
    ? [
        { key: "From", value: message.From ? `${message.From.Name} <${message.From.Address}>` : "" },
        { key: "To", value: addrLine(message.To) },
        ...(message.Cc && message.Cc.length ? [{ key: "Cc", value: addrLine(message.Cc) }] : []),
        { key: "Subject", value: message.Subject },
        { key: "Date", value: message.Date },
        { key: "Message-ID", value: message.MessageID },
        { key: "Size", value: formatSize(message.Size) },
      ]
    : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted hover:text-fg md:hidden"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Stream
            </button>
          )}
          <div className="mb-1.5 flex items-center gap-2">
            <Badge status="neutral" dot>
              Captured
            </Badge>
            {item.tags.map((t) => (
              <span key={t} className="flex items-center gap-1 font-mono text-2xs text-muted">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: tagColor(t) }} aria-hidden />
                {t}
              </span>
            ))}
          </div>
          <h2 className="truncate text-lg font-semibold tracking-[-0.01em]">{item.subject}</h2>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">
            {item.fromAddress} → {item.to}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => notify("Tagging lands in the next step", "neutral")}>
            <TagIcon className="size-3.5" aria-hidden /> Tag
          </Button>
          <Button variant="ghost" size="sm" onClick={() => notify("Download lands in the next step", "neutral")}>
            <Download className="size-3.5" aria-hidden /> Download
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setReleaseOpen(true)}>
            <Send className="size-3.5" aria-hidden /> Release
          </Button>
          <Button variant="ghost" size="sm" onClick={() => notify("Delete lands in the next step", "neutral")} aria-label="Delete">
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="px-5">
        <Tabs items={tabs} value={tab} onValueChange={setTab} idBase="inspector" />
      </div>

      <div
        id={panelId("inspector")}
        role="tabpanel"
        aria-labelledby={tabId("inspector", tab)}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-5"
      >
        {error && (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-error">{error}</p>
        )}
        {!error && !message && CONTENT_TABS.includes(tab) && (
          <p className="text-sm text-muted">Loading message…</p>
        )}

        {/* Check panels fetch on their own and don't need the message JSON. */}
        {tab === "htmlcheck" && <HtmlCheckPanel sandbox={sandbox} id={item.id} />}
        {tab === "links" && <LinkCheckPanel sandbox={sandbox} id={item.id} />}
        {tab === "spam" && <SpamCheckPanel sandbox={sandbox} id={item.id} />}

        {message && tab === "preview" && (
          <div className="mx-auto max-w-2xl overflow-hidden rounded-md border border-border bg-white">
            {message.HTML ? (
              <iframe
                title="Message preview"
                sandbox=""
                srcDoc={message.HTML}
                className="h-[60vh] w-full"
              />
            ) : (
              <pre className="whitespace-pre-wrap p-6 font-sans text-sm text-[#111]">
                {message.Text || "(empty message)"}
              </pre>
            )}
          </div>
        )}
        {message && tab === "html" && (
          <pre className="overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-fg">
            {message.HTML || "(no HTML part)"}
          </pre>
        )}
        {message && tab === "text" && (
          <pre className="overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-fg">
            {message.Text || "(no text part)"}
          </pre>
        )}
        {message && tab === "headers" && <KeyValueTable rows={headers} />}
        {message && tab === "attachments" && (
          <AttachmentsPanel
            sandbox={sandbox}
            id={item.id}
            attachments={message.Attachments ?? []}
            inline={message.Inline ?? []}
          />
        )}
      </div>

      <ReleaseDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        sandbox={sandbox}
        messageId={item.id}
        defaultTo={(message?.To ?? []).map((a) => a.Address)}
        relay={webui?.MessageRelay ?? null}
      />
    </div>
  );
}
