"use client";

import { useEffect, useRef } from "react";
import type { WSNotification } from "./types";

// Resolve the websocket URL. In dev the API lives on another origin (the Next
// rewrite only proxies HTTP, not the WS upgrade), so NEXT_PUBLIC_WS_URL points
// straight at the Go server. In prod, same-origin /api/events.
function wsURL(): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override) return override;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/events`;
}

// Subscribe to the live capture stream. The `/api/events` broadcast is global
// (not sandbox-scoped server-side yet — tracked for the isolation phase), so the
// caller filters by the active sandbox. `key` forces a reconnect when it
// changes, which is how switching sandboxes re-scopes the subscription.
export function useEvents(key: string | null, onEvent: (n: WSNotification) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!key) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsURL());
      ws.onmessage = (e) => {
        try {
          handler.current(JSON.parse(e.data) as WSNotification);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [key]);
}
