"use client";

import { useEffect, useState } from "react";

export type Suggestion = {
  kind: "movie" | "person";
  id: number;
  label: string;
  detail: string | null;
  image: string | null;
  href: string;
};

/**
 * Debounced typeahead results from /api/search for a query. "people" asks for
 * people only. A response for a query the user has moved on from is dropped.
 */
export function useSuggestions(query: string, kind: "all" | "people" = "all"): Suggestion[] {
  const [items, setItems] = useState<Suggestion[]>([]);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const kindParam = kind === "people" ? "&kind=people" : "";
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${kindParam}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setItems(data.suggestions);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, kind]);

  // Suggestions for a query that's since been cleared shouldn't show.
  return q.length >= 2 ? items : [];
}
