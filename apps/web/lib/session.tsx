"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
import type { Sandbox } from "./types";

const ACTIVE_KEY = "fauxbox-sandbox";

interface Session {
  sandboxes: Sandbox[];
  activeSandbox: Sandbox | null;
  setActiveSandbox: (id: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const SessionContext = createContext<Session | null>(null);

function storedActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listSandboxes()
      .then((list) => {
        if (cancelled) return;
        setSandboxes(list);
        const saved = storedActive();
        const pick = list.find((s) => s.id === saved) ?? list[0] ?? null;
        setActiveId(pick?.id ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load sandboxes");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, nonce]);

  const setActiveSandbox = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // storage unavailable; the choice still applies for this session
    }
  }, []);

  const activeSandbox = sandboxes.find((s) => s.id === activeId) ?? null;

  return (
    <SessionContext.Provider
      value={{
        sandboxes,
        activeSandbox,
        setActiveSandbox,
        loading,
        error,
        reload: () => setNonce((n) => n + 1),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
