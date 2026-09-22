"use client";

import { useState } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { MessageRow } from "@/components/inbox/message-row";
import { MessageViewer } from "@/components/inbox/message-viewer";
import { Badge } from "@/components/ui/badge";
import { MESSAGES } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

export function InboxClient() {
  const [selectedId, setSelectedId] = useState<string | null>(MESSAGES[0].id);
  const selected = MESSAGES.find((m) => m.id === selectedId) ?? null;
  const unread = MESSAGES.filter((m) => m.unread).length;

  return (
    <div className="flex h-full min-h-0">
      {/* Capture stream — full width on mobile, fixed panel on desktop. Hidden on
          mobile once a message is open so the inspector gets the whole screen. */}
      <section
        className={cn(
          "flex w-full flex-col border-r border-border md:w-[26rem] md:shrink-0",
          selected && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-xs font-medium text-muted">Capture stream</span>
          <Badge status="ok" mono>
            {unread} new
          </Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {MESSAGES.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              selected={m.id === selectedId}
              onSelect={() => setSelectedId(m.id)}
            />
          ))}
        </div>
      </section>

      {/* Inspector — hidden on mobile until a message is selected */}
      <section className={cn("min-w-0 flex-1", !selected && "hidden md:block")}>
        {selected ? (
          <MessageViewer message={selected} onBack={() => setSelectedId(null)} />
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
    </div>
  );
}
