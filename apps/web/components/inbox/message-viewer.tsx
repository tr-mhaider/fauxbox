"use client";

import { useState } from "react";
import { Download, Send, Trash2, Tag as TagIcon, ArrowLeft } from "lucide-react";
import { Tabs, tabId, panelId, type TabItem } from "@/components/ui/tabs";
import { KeyValueTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Message } from "@/lib/sample-data";
import { formatSize } from "@/lib/sample-data";

const TABS: TabItem[] = [
  { id: "preview", label: "Preview" },
  { id: "html", label: "HTML" },
  { id: "text", label: "Text" },
  { id: "headers", label: "Headers", count: 8 },
  { id: "raw", label: "Raw" },
  { id: "parts", label: "Parts" },
];

export function MessageViewer({ message, onBack }: { message: Message; onBack?: () => void }) {
  const [tab, setTab] = useState("preview");
  const { notify } = useToast();

  const headers = [
    { key: "From", value: `${message.fromName} <${message.from}>` },
    { key: "To", value: message.to },
    { key: "Subject", value: message.subject },
    { key: "Message-ID", value: `<${message.id}@fauxbox.dev>` },
    { key: "Content-Type", value: "multipart/alternative" },
    { key: "MIME-Version", value: "1.0" },
    { key: "X-Sandbox", value: "checkout-staging" },
    { key: "Size", value: formatSize(message.sizeBytes) },
  ];

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
            <Badge status={message.status} dot>
              {message.status === "error" ? "Bounced" : message.status === "warn" ? "Flagged" : "Delivered"}
            </Badge>
            {message.tags.map((t) => (
              <span key={t} className="font-mono text-2xs text-faint">
                #{t}
              </span>
            ))}
          </div>
          <h2 className="truncate text-lg font-semibold tracking-[-0.01em]">{message.subject}</h2>
          <p className="mt-0.5 truncate font-mono text-xs text-muted">
            {message.from} → {message.to}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => notify("Tagged message", "ok")}>
            <TagIcon className="size-3.5" aria-hidden /> Tag
          </Button>
          <Button variant="ghost" size="sm" onClick={() => notify("Downloading .eml", "neutral")}>
            <Download className="size-3.5" aria-hidden /> Download
          </Button>
          <Button variant="secondary" size="sm" onClick={() => notify("Relay is disabled in the demo", "warn")}>
            <Send className="size-3.5" aria-hidden /> Release
          </Button>
          <Button variant="ghost" size="sm" onClick={() => notify("Deleted message", "error")} aria-label="Delete">
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="px-5">
        <Tabs items={TABS} value={tab} onValueChange={setTab} idBase="inspector" />
      </div>

      <div
        id={panelId("inspector")}
        role="tabpanel"
        aria-labelledby={tabId("inspector", tab)}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto p-5"
      >
        {tab === "preview" && (
          <div className="mx-auto max-w-2xl rounded-md border border-border bg-white p-6 text-[#111]">
            {/* Untrusted HTML renders in a sandboxed iframe in production; this is a
                static preview placeholder for the demo. */}
            <p className="text-sm">
              This pane renders the captured HTML body inside a sandboxed <code>iframe</code>.
            </p>
            <p className="mt-2 text-sm text-neutral-600">{message.preview}</p>
          </div>
        )}
        {tab === "headers" && <KeyValueTable rows={headers} />}
        {(tab === "html" || tab === "text" || tab === "raw") && (
          <pre className="overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-fg">
            {tab === "raw"
              ? `Return-Path: <${message.from}>\nDelivered-To: ${message.to}\nSubject: ${message.subject}\nContent-Type: multipart/alternative; boundary="fauxbox"\n\n--fauxbox\nContent-Type: text/plain\n\n${message.preview}\n--fauxbox--`
              : tab === "text"
                ? message.preview
                : `<!doctype html>\n<html>\n  <body>\n    <h1>${message.subject}</h1>\n    <p>${message.preview}</p>\n  </body>\n</html>`}
          </pre>
        )}
        {tab === "parts" && (
          <KeyValueTable
            rows={[
              { key: "text/plain", value: "1.2 KB" },
              { key: "text/html", value: formatSize(message.sizeBytes) },
              { key: "attachments", value: `${Math.max(0, message.parts - 2)}` },
            ]}
          />
        )}
      </div>
    </div>
  );
}
