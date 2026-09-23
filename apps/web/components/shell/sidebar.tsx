"use client";

import { Inbox, Search, Tags, Settings, Radio } from "lucide-react";
import { SandboxSwitcher } from "./sandbox-switcher";
import { useSession } from "@/lib/session";
import { useSearch } from "@/lib/search";
import { useTags } from "@/lib/use-tags";
import { tagColor } from "@/lib/tag-color";
import { cn } from "@/lib/cn";

const NAV = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "search", label: "Search", icon: Search },
  { id: "tags", label: "Tags", icon: Tags },
  { id: "settings", label: "Settings", icon: Settings },
];

const tagQuery = (t: string) => `tag:"${t}"`;

export function Sidebar({
  active = "inbox",
  onNavigate,
}: {
  active?: string;
  onNavigate?: () => void;
}) {
  const { sandboxes, activeSandbox, setActiveSandbox, loading } = useSession();
  const { query, setQuery } = useSearch();
  const tags = useTags(activeSandbox?.id ?? null);

  const trimmed = query.trim();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg">
          <Radio className="size-4" aria-hidden />
        </span>
        <span className="text-md font-semibold tracking-[-0.01em]">Fauxbox</span>
      </div>

      <div className="px-3 pb-2">
        <SandboxSwitcher
          sandboxes={sandboxes}
          activeId={activeSandbox?.id ?? null}
          loading={loading}
          onSelect={setActiveSandbox}
        />
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-2">
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
            </a>
          );
        })}
      </nav>

      {/* Tag filter: click to scope the inbox to tag:"name"; click again to clear. */}
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-3">
        <p className="px-2.5 pb-1 text-2xs font-medium uppercase tracking-wide text-faint">Tags</p>
        <div className="min-h-0 flex-1 overflow-auto">
          {tags.length === 0 ? (
            <p className="px-2.5 py-1 text-2xs text-faint">No tags yet</p>
          ) : (
            tags.map((t) => {
              const isActive = trimmed === tagQuery(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setQuery(isActive ? "" : tagQuery(t))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                    isActive ? "bg-accent-weak text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tagColor(t) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{t}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 text-2xs text-faint">
        <span className="font-mono">v0.9 · phase 9</span>
      </div>
    </aside>
  );
}
