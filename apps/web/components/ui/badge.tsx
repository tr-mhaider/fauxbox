import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type Status = "ok" | "warn" | "error" | "pending" | "neutral";

// Status color mapped to the functional palette. Color is never the only signal:
// callers pair it with an icon or text label.
const statusRing: Record<Status, string> = {
  ok: "text-ok border-ok/30 bg-ok/10",
  warn: "text-warn border-warn/30 bg-warn/10",
  error: "text-error border-error/30 bg-error/10",
  pending: "text-pending border-pending/30 bg-pending/10",
  neutral: "text-muted border-border-strong bg-surface-2",
};

const statusDot: Record<Status, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-error",
  pending: "bg-pending",
  neutral: "bg-faint",
};

interface BadgeProps {
  status?: Status;
  dot?: boolean;
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ status = "neutral", dot, mono, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium",
        statusRing[status],
        mono && "font-mono tabular tracking-tight",
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", statusDot[status])} aria-hidden />}
      {children}
    </span>
  );
}

// Small tag chip for user labels (message tags). Neutral by default; the caller
// can pass a color class for tag-specific hues later.
interface TagProps {
  className?: string;
  children: React.ReactNode;
  onRemove?: () => void;
}

export function Tag({ className, children, onRemove }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-muted",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tag"
          className="text-faint hover:text-fg"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
