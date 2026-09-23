"use client";

import { useEffect, useRef } from "react";
import type { WSNotification } from "./types";

// Resolve the websocket URL. In dev the API lives on another origin (the Next
// rewrite only proxies HTTP, not the WS upgrade), so NEXT_PUBLIC_WS_URL points
// straight at the Go server. In prod, same-origin /api/events.
function wsURL(sandbox: string): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  const base =
    override ?? `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/events`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}sandbox=${encodeURIComponent(sandbox)}`;
}

// Subscribe to the live capture stream for one sandbox. The sandbox id is sent
// as `?sandbox=` on the connection; the server authorizes it against the session
// and scopes the event stream to it, so a client only receives its own tenant's
// events. `key` (the sandbox id) forces a reconnect when it changes, re-scoping
// the subscription on a sandbox switch.
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
      ws = new WebSocket(wsURL(key));
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
