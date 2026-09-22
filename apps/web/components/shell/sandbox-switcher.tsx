"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Circle } from "lucide-react";
import type { Sandbox } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

// Framed as choosing a capture interface: mono sandbox ID + subdomain, a
// connection dot per sandbox.
export function SandboxSwitcher({
  sandboxes,
  activeId,
  onSelect,
}: {
  sandboxes: Sandbox[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = sandboxes.find((s) => s.id === activeId) ?? sandboxes[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md border border-border-strong bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
      >
        <Circle
          className={cn("size-2 shrink-0", active.connected ? "fill-ok text-ok" : "fill-faint text-faint")}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{active.name}</span>
          <span className="block truncate font-mono text-2xs text-faint">
            {active.subdomain}.fauxbox.dev
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-faint" aria-hidden />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-md border border-border bg-elevated p-1 shadow-e2"
        >
          {sandboxes.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === activeId}
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <Circle
                  className={cn("size-2 shrink-0", s.connected ? "fill-ok text-ok" : "fill-faint text-faint")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{s.name}</span>
                  <span className="block truncate font-mono text-2xs text-faint">{s.id}</span>
                </span>
                {s.id === activeId && <Check className="size-3.5 shrink-0 text-accent" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
