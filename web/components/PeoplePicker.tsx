"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { MAX_PEOPLE, togetherPath } from "@/lib/together";
import type { PersonSummary } from "@/lib/types";
import { TmdbImage } from "./TmdbImage";
import { useSuggestions } from "./useSuggestions";

/**
 * Chooses the people for a films-together search. Each pick or removal
 * updates the URL (/together?ids=...), and the page shows the shared films.
 * Suggestions show a photo and department, so people with the same name can
 * be told apart.
 */
export function PeoplePicker({ selected, autoFocus = false }: { selected: PersonSummary[]; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  const ids = selected.map((p) => p.tmdb_id);
  const suggestions = useSuggestions(query, "people").filter((s) => !ids.includes(s.id));
  const full = ids.length >= MAX_PEOPLE;
  const showList = open && suggestions.length > 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (next: number[]) => {
    setQuery("");
    setOpen(false);
    setActive(-1);
    startTransition(() => router.push(togetherPath(next), { scroll: false }));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[active] ?? suggestions[0];
      if (pick) go([...ids, pick.id]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && ids.length) {
      go(ids.slice(0, -1));
    }
  };

  return (
    <div className={`picker${pending ? " pending" : ""}`} ref={boxRef}>
      <ul className="picker-chips">
        {selected.map((p) => (
          <li key={p.tmdb_id} className="chip">
            <TmdbImage path={p.profile_path} alt={p.name} width={28} aspect="profile" />
            <span>{p.name}</span>
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => go(ids.filter((id) => id !== p.tmdb_id))}>
              &times;
            </button>
          </li>
        ))}
        {!full && (
          <li className="picker-input">
            <input
              type="text"
              value={query}
              placeholder={selected.length ? "Add another person" : "Type a name, like Scorsese"}
              autoComplete="off"
              autoFocus={autoFocus}
              aria-label="Add a person"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
            />
            {showList && (
              <ul id={listId} className="suggestions" role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={s.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? "active" : ""}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go([...ids, s.id]);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <TmdbImage path={s.image} alt={s.label} width={28} aspect="profile" className="suggestion-img" />
                    <span className="suggestion-label">{s.label}</span>
                    {s.detail && <span className="suggestion-detail">{s.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
      {full && <p className="sub">That&apos;s the most people one search can take ({MAX_PEOPLE}).</p>}
    </div>
  );
}
