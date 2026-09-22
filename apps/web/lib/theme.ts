"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function current(): Theme {
  if (typeof document === "undefined") return "dark";
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

// Reads/writes the same key and attribute the no-flash script in layout uses.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => setTheme(current()), []);

  const toggle = useCallback(() => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("fauxbox-theme", next);
    } catch {
      // storage may be unavailable (private mode); the attribute still applies
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}
