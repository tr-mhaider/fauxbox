"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Namespace for tab/panel ids so a panel can point back with aria-labelledby. */
  idBase?: string;
  className?: string;
}

export const tabId = (base: string, id: string) => `${base}-tab-${id}`;
export const panelId = (base: string) => `${base}-panel`;

// Inspector-style tab bar with an underline rail on the active tab. Implements
// the ARIA tabs pattern: roving tabindex + Left/Right/Home/End navigation, and
// aria-controls linking each tab to the shared panel (see MessageViewer).
export function Tabs({ items, value, onValueChange, idBase = "tabs", className }: TabsProps) {
  const enabled = items.filter((t) => !t.disabled);

  function onKeyDown(e: React.KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = enabled.findIndex((t) => t.id === value);
    let next = idx;
    if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    const target = enabled[next];
    if (!target) return;
    onValueChange(target.id);
    document.getElementById(tabId(idBase, target.id))?.focus();
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-stretch gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]",
        className,
      )}
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            id={tabId(idBase, t.id)}
            role="tab"
            aria-selected={active}
            aria-controls={panelId(idBase)}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onValueChange(t.id)}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-40",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="font-mono tabular text-2xs text-faint">{t.count}</span>
            )}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
