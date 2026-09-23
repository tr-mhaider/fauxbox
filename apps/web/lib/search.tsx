"use client";

import { createContext, useContext, useState } from "react";

interface SearchState {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchState | null>(null);

// Shares the topbar search box with the inbox list. Per-page state (the sidebar
// navigates with full page loads, so it resets between pages); not URL-synced —
// shareable search links can come later if needed.
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchState {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
