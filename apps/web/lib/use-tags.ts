"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useEvents } from "./use-events";

// The sandbox's tag list, kept live. Tagging/deletion broadcast "update" /
// "delete" over the same socket, so refetch on those.
// ponytail: opens its own websocket alongside the inbox's; fold into a shared
// events context if the extra connection ever matters.
export function useTags(sandboxId: string | null): string[] {
  const [tags, setTags] = useState<string[]>([]);

  const load = useCallback(() => {
    if (!sandboxId) {
      setTags([]);
      return;
    }
    api
      .getTags(sandboxId)
      .then(setTags)
      .catch(() => {
        // a failed tag fetch just leaves the filter list empty
      });
  }, [sandboxId]);

  useEffect(() => load(), [load]);

  useEvents(sandboxId, (n) => {
    if (n.Type === "update" || n.Type === "new" || n.Type === "delete" || n.Type === "truncate") {
      load();
    }
  });

  return tags;
}
