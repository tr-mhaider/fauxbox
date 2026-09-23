"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";

const KEY = "fauxbox-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function storedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // storage unavailable
  }
  return "system";
}

function resolved(): Theme {
  if (typeof document === "undefined") return "dark";
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return systemTheme();
}

// Applies a mode: light/dark pin the data-theme attribute (and persist); system
// removes the attribute so the CSS media query governs. Mirrors the no-flash
// script in layout, which only honors "light"/"dark".
function apply(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    // storage unavailable; the attribute below still applies for this session
  }
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setMode(storedMode());
    setTheme(resolved());
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (storedMode() === "system") setTheme(resolved());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setThemeMode = useCallback((next: ThemeMode) => {
    apply(next);
    setMode(next);
    setTheme(resolved());
  }, []);

  // Quick light/dark flip for the topbar button.
  const toggle = useCallback(() => setThemeMode(resolved() === "dark" ? "light" : "dark"), [setThemeMode]);

  return { theme, mode, setMode: setThemeMode, toggle };
}
