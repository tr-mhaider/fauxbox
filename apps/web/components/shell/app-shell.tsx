"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { ToastProvider } from "@/components/ui/toast";
import { SANDBOXES } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

export function AppShell({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
}) {
  const [sandbox, setSandbox] = useState(SANDBOXES[0].id);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden">
        {/* Sidebar: static from md up, off-canvas drawer below it */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-[var(--ease-out)] md:static md:z-auto md:translate-x-0",
            navOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            active={active}
            activeSandbox={sandbox}
            onSandbox={setSandbox}
            onNavigate={() => setNavOpen(false)}
          />
        </div>
        {navOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} onMenu={() => setNavOpen(true)} />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
