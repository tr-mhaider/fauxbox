"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { Status } from "./badge";
import { cn } from "@/lib/cn";

interface Toast {
  id: number;
  message: string;
  status: Status;
}

interface ToastCtx {
  notify: (message: string, status?: Status) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
  pending: Info,
  neutral: Info,
} as const;

const tone: Record<Status, string> = {
  ok: "text-ok",
  warn: "text-warn",
  error: "text-error",
  pending: "text-pending",
  neutral: "text-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, status: Status = "neutral") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, status }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const Icon = icons[t.status];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-elevated px-3.5 py-3 text-sm text-fg shadow-e2 animate-[toast-in_180ms_var(--ease-out)]"
            >
              <Icon className={cn("mt-px size-4 shrink-0", tone[t.status])} aria-hidden />
              <span className="leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
