import { cn } from "@/lib/cn";

// Live-capture status. The pulsing dot uses the reserved --capture hue and is
// the only pulsing element in the app. Text label carries the meaning too, so
// the state is never color-only.
export function CaptureIndicator({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium">
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-capture animate-pulse-dot" : "bg-faint",
        )}
        aria-hidden
      />
      <span className={cn("font-mono tracking-wide", active ? "text-capture" : "text-faint")}>
        {active ? "CAPTURING" : "PAUSED"}
      </span>
    </span>
  );
}
