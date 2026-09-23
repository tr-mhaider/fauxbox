"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Sun, Moon, User, Menu, SlidersHorizontal, X } from "lucide-react";
import { CaptureIndicator } from "./capture-indicator";
import { useTheme } from "@/lib/theme";
import { useSearch } from "@/lib/search";
import { cn } from "@/lib/cn";

// Quick-insert operators for the search grammar. Complete tokens apply on their
// own; field prefixes drop in and wait for the user to type a value.
const FILTERS: { token: string; label: string }[] = [
  { token: "is:unread", label: "Unread" },
  { token: "is:read", label: "Read" },
  { token: "is:tagged", label: "Tagged" },
  { token: "has:attachment", label: "Has attachment" },
];
const FIELDS: { token: string; label: string }[] = [
  { token: "from:", label: "From" },
  { token: "to:", label: "To" },
  { token: "subject:", label: "Subject" },
  { token: "tag:", label: "Tag" },
  { token: "larger:", label: "Larger than" },
  { token: "before:", label: "Before date" },
];

export function TopBar({ title, onMenu }: { title: string; onMenu?: () => void }) {
  const { theme, toggle } = useTheme();
  const { query, setQuery } = useSearch();
  const [value, setValue] = useState(query);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the box in sync when the query is cleared elsewhere (e.g. sandbox switch).
  useEffect(() => setValue(query), [query]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function insert(token: string) {
    setValue((v) => {
      const base = v.trimEnd();
      const next = base ? `${base} ${token}` : token;
      // Field prefixes (ending in ":") wait for a value; complete tokens get a space.
      return token.endsWith(":") ? next : `${next} `;
    });
    setMenuOpen(false);
    inputRef.current?.focus();
  }

  function clear() {
    setValue("");
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="-ml-1 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg md:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </button>
      <h1 className="text-md font-semibold tracking-[-0.01em]">{title}</h1>

      <form
        className="relative ml-2 hidden max-w-md flex-1 md:block"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(value.trim());
        }}
      >
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="from:  to:  subject:  is:unread  has:attachment"
          aria-label="Search messages"
          className="h-9 w-full rounded-md border border-border-strong bg-surface-2 pl-8 pr-16 font-mono text-xs text-fg placeholder:text-faint focus-visible:border-accent"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
          {value && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="grid size-7 place-items-center rounded text-faint hover:text-fg"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Search filters"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={cn(
                "grid size-7 place-items-center rounded hover:text-fg",
                menuOpen ? "text-accent" : "text-faint",
              )}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-md border border-border bg-elevated p-1 shadow-e2"
              >
                <p className="px-2 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
                  Filters
                </p>
                {FILTERS.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    role="menuitem"
                    onClick={() => insert(f.token)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
                  >
                    {f.label}
                    <span className="font-mono text-2xs text-faint">{f.token}</span>
                  </button>
                ))}
                <p className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-faint">
                  Fields
                </p>
                {FIELDS.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    role="menuitem"
                    onClick={() => insert(f.token)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
                  >
                    {f.label}
                    <span className="font-mono text-2xs text-faint">{f.token}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <CaptureIndicator active />
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
        </button>
        <a
          href="/account"
          aria-label="Account"
          className="grid size-9 place-items-center rounded-md border border-border-strong bg-surface-2 text-muted transition-colors hover:text-fg"
        >
          <User className="size-4" aria-hidden />
        </a>
      </div>
    </header>
  );
}
