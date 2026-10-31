"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { kind: "movie" | "person"; id: number; label: string; detail: string | null; href: string };

/**
 * Search field with a typeahead dropdown. Typing asks /api/search for the top
 * movies and people; Enter with nothing highlighted goes to the full results
 * page. Works as a plain GET form without JavaScript.
 */
export function SearchBox({ initialQuery = "", autoFocus = false }: { initialQuery?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);

  // Debounced fetch. A stale response is ignored if the query moved on.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setItems(data.suggestions);
        setActive(-1);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown on a click outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Suggestions for a query that's since been cleared shouldn't show.
  const shown = query.trim().length >= 2 ? items : [];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && shown.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && open && active >= 0 && shown[active]) {
      e.preventDefault();
      go(shown[active].href);
    }
  };

  const showList = open && shown.length > 0;

  return (
    <form
      ref={boxRef}
      className="search-box"
      role="search"
      action="/search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        if (q) go(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <input
        type="search"
        name="q"
        value={query}
        placeholder="Search movies and people"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label="Search movies and people"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul id={listId} className="suggestions" role="listbox">
          {shown.map((s, i) => (
            <li
              key={`${s.kind}-${s.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.href);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="suggestion-kind">{s.kind === "movie" ? "Movie" : "Person"}</span>
              <span className="suggestion-label">{s.label}</span>
              {s.detail && <span className="suggestion-detail">{s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
