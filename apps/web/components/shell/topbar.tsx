"use client";

import { Search, Sun, Moon, User, Menu } from "lucide-react";
import { CaptureIndicator } from "./capture-indicator";
import { useTheme } from "@/lib/theme";

export function TopBar({ title, onMenu }: { title: string; onMenu?: () => void }) {
  const { theme, toggle } = useTheme();
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

      <div className="relative ml-2 hidden max-w-md flex-1 md:block">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <input
          type="search"
          placeholder="from:  to:  subject:  is:unread  has:attachment"
          aria-label="Filter messages"
          className="h-9 w-full rounded-md border border-border-strong bg-surface-2 pl-8 pr-3 font-mono text-xs text-fg placeholder:text-faint focus-visible:border-accent"
        />
      </div>

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
        <button
          type="button"
          aria-label="Account menu"
          className="grid size-9 place-items-center rounded-md border border-border-strong bg-surface-2 text-muted transition-colors hover:text-fg"
        >
          <User className="size-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}
