"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import type { WebUIConfig } from "./types";

// The web UI config is global and effectively static, so fetch it once and
// share the promise across every caller.
let cached: Promise<WebUIConfig> | null = null;

function load(): Promise<WebUIConfig> {
  if (!cached) cached = api.getWebUIConfig();
  return cached;
}

export function useWebUIConfig(): WebUIConfig | null {
  const [config, setConfig] = useState<WebUIConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((c) => !cancelled && setConfig(c))
      .catch(() => {
        // a failed config load leaves optional features (release) unavailable
        cached = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}
