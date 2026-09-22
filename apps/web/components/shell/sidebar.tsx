"use client";

import { Inbox, Search, Tags, Settings, Radio } from "lucide-react";
import { SandboxSwitcher } from "./sandbox-switcher";
import { SANDBOXES } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

const NAV = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: 5 },
  { id: "search", label: "Search", icon: Search },
  { id: "tags", label: "Tags", icon: Tags },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  active = "inbox",
  activeSandbox,
  onSandbox,
  onNavigate,
}: {
  active?: string;
  activeSandbox: string;
  onSandbox: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
          <Radio className="size-4" aria-hidden />
        </span>
        <span className="text-md font-semibold tracking-[-0.01em]">Fauxbox</span>
      </div>

      <div className="px-3 pb-2">
        <SandboxSwitcher sandboxes={SANDBOXES} activeId={activeSandbox} onSelect={onSandbox} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <a
              key={item.id}
              href={`/${item.id}`}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-weak text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {typeof item.count === "number" && (
                <span className="font-mono tabular text-2xs text-faint">{item.count}</span>
              )}
            </a>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-2xs text-faint">
        <span className="font-mono">v0.8 · phase 8</span>
      </div>
    </aside>
  );
}
