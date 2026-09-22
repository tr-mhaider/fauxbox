import { Paperclip, AlertTriangle, XCircle, Clock, type LucideIcon } from "lucide-react";
import type { Message } from "@/lib/sample-data";
import { formatAge, formatSize } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

const rail: Record<Message["status"], string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-error",
  pending: "bg-pending",
  neutral: "bg-border-strong",
};

const statusLabel: Record<Message["status"], string> = {
  ok: "Delivered",
  warn: "Flagged",
  error: "Bounced",
  pending: "Queued",
  neutral: "Captured",
};

// Non-color status cue for the states that need attention. "ok" stays icon-free
// (the expected state); the rail + aria-label still carry it. This keeps status
// from being conveyed by color alone (WCAG 1.4.1).
const statusIcon: Partial<Record<Message["status"], LucideIcon>> = {
  warn: AlertTriangle,
  error: XCircle,
  pending: Clock,
};

const statusIconColor: Record<Message["status"], string> = {
  ok: "text-ok",
  warn: "text-warn",
  error: "text-error",
  pending: "text-pending",
  neutral: "text-faint",
};

// Relative size bar caps at 200 KB for the demo scale.
function sizePct(bytes: number) {
  return Math.min(100, Math.round((bytes / 204800) * 100));
}

export function MessageRow({
  message,
  selected,
  onSelect,
}: {
  message: Message;
  selected: boolean;
  onSelect: () => void;
}) {
  const StatusIcon = statusIcon[message.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={`${statusLabel[message.status]}${message.unread ? ", unread" : ""}: ${message.subject}, from ${message.fromName}`}
      className={cn(
        "relative flex w-full flex-col gap-1 border-b border-border py-2.5 pl-4 pr-3 text-left transition-colors",
        selected ? "bg-accent-weak" : "hover:bg-surface-2",
      )}
    >
      {/* 2px status rail — sanctioned colored left edge, part of the status system */}
      <span className={cn("absolute inset-y-0 left-0 w-0.5", rail[message.status])} aria-hidden />

      <div className="flex items-center gap-2">
        {message.unread && (
          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            message.unread ? "font-semibold text-fg" : "text-muted",
          )}
        >
          {message.fromName}
        </span>
        {StatusIcon && (
          <StatusIcon
            className={cn("size-3 shrink-0", statusIconColor[message.status])}
            aria-hidden
          />
        )}
        <span className="shrink-0 font-mono tabular text-2xs text-faint">
          {formatAge(message.ageSeconds)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", message.unread ? "text-fg" : "text-muted")}>
          {message.subject}
        </span>
        {message.parts > 1 && (
          <span className="flex shrink-0 items-center gap-0.5 font-mono text-2xs text-faint">
            <Paperclip className="size-3" aria-hidden />
            {message.parts}
          </span>
        )}
      </div>

      <p className="truncate text-xs text-faint">{message.preview}</p>

      <div className="mt-0.5 flex items-center gap-2">
        <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2">
          <span
            className="block h-full rounded-full bg-border-strong"
            style={{ width: `${sizePct(message.sizeBytes)}%` }}
          />
        </span>
        <span className="font-mono tabular text-2xs text-faint">{formatSize(message.sizeBytes)}</span>
        {message.tags.map((t) => (
          <span key={t} className="truncate font-mono text-2xs text-faint">
            #{t}
          </span>
        ))}
      </div>
    </button>
  );
}
