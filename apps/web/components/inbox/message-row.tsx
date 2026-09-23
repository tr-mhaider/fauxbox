import { Paperclip } from "lucide-react";
import type { MessageItem } from "@/lib/view-model";
import { formatAge, formatSize } from "@/lib/view-model";
import { tagColor } from "@/lib/tag-color";
import { cn } from "@/lib/cn";

// Relative size bar caps at 200 KB.
function sizePct(bytes: number) {
  return Math.min(100, Math.round((bytes / 204800) * 100));
}

export function MessageRow({
  message,
  selected,
  checked,
  onSelect,
  onToggleCheck,
}: {
  message: MessageItem;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full border-b border-border transition-colors",
        selected ? "bg-accent-weak" : checked ? "bg-surface-2" : "hover:bg-surface-2",
      )}
    >
      {/* 2px neutral capture rail */}
      <span className="absolute inset-y-0 left-0 w-0.5 bg-border-strong" aria-hidden />

      <label className="flex shrink-0 cursor-pointer items-center pl-3 pr-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          aria-label={`Select message: ${message.subject}`}
          className="size-3.5 cursor-pointer rounded border-border-strong"
          style={{ accentColor: "var(--accent)" }}
        />
      </label>

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        aria-label={`${message.unread ? "Unread: " : ""}${message.subject}, from ${message.fromName}`}
        className="flex min-w-0 flex-1 flex-col gap-1 py-2.5 pl-1 pr-3 text-left"
      >
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
          <span className="shrink-0 font-mono tabular text-2xs text-faint">
            {formatAge(message.createdISO)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", message.unread ? "text-fg" : "text-muted")}>
            {message.subject}
          </span>
          {message.attachments > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 font-mono text-2xs text-faint">
              <Paperclip className="size-3" aria-hidden />
              {message.attachments}
            </span>
          )}
        </div>

        {message.preview && <p className="truncate text-xs text-faint">{message.preview}</p>}

        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-border-strong"
              style={{ width: `${sizePct(message.sizeBytes)}%` }}
            />
          </span>
          <span className="font-mono tabular text-2xs text-faint">{formatSize(message.sizeBytes)}</span>
          {message.tags.map((t) => (
            <span key={t} className="flex min-w-0 items-center gap-1 truncate font-mono text-2xs text-muted">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tagColor(t) }} aria-hidden />
              {t}
            </span>
          ))}
        </div>
      </button>
    </div>
  );
}
