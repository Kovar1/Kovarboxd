"use client";

import { useState, useTransition } from "react";
import { setSeen, setSeenDate, setWatchlist, type ListResult } from "@/lib/list-actions";
import type { MovieStatus } from "@/lib/list-rules";

/** Seen and Watchlist buttons, plus an optional date, for a movie page. */
export function ListButtons({ movieId, initial }: { movieId: number; initial: MovieStatus }) {
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Update the screen straight away, and undo it if the save fails.
  const apply = (next: MovieStatus, save: () => Promise<ListResult>) => {
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await save();
      if (result.error) {
        setStatus(previous);
        setError(result.error);
      }
    });
  };

  return (
    <div className="list-buttons">
      <button
        type="button"
        className={status.seen ? "list-button on" : "list-button"}
        aria-pressed={status.seen}
        disabled={pending}
        onClick={() =>
          apply(
            // Marking it seen also takes it off the watchlist (see setSeen).
            status.seen
              ? { seen: false, seenOn: null, watchlist: status.watchlist }
              : { seen: true, seenOn: status.seenOn, watchlist: false },
            () => setSeen(movieId, !status.seen),
          )
        }
      >
        {status.seen ? "✓ Seen" : "Mark seen"}
      </button>
      <button
        type="button"
        className={status.watchlist ? "list-button on" : "list-button"}
        aria-pressed={status.watchlist}
        disabled={pending}
        onClick={() => apply({ ...status, watchlist: !status.watchlist }, () => setWatchlist(movieId, !status.watchlist))}
      >
        {status.watchlist ? "✓ On watchlist" : "+ Watchlist"}
      </button>
      {status.seen && (
        <label className="seen-date">
          <span>Seen on</span>
          {/* Saves when you leave the field, so half-typed years never get stored. */}
          <input
            key={status.seenOn ?? "none"}
            type="date"
            defaultValue={status.seenOn ?? ""}
            onBlur={(e) => {
              const date = e.target.value;
              if (date !== (status.seenOn ?? "")) {
                apply({ ...status, seenOn: date || null }, () => setSeenDate(movieId, date));
              }
            }}
          />
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/** A small Seen toggle for rows in a list of films. */
export function SeenToggle({ movieId, initial }: { movieId: number; initial: boolean }) {
  const [seen, setSeenState] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={seen ? "seen-toggle on" : "seen-toggle"}
      aria-pressed={seen}
      disabled={pending}
      title={failed ? "That didn't save. Try again." : undefined}
      onClick={() => {
        const next = !seen;
        setSeenState(next);
        setFailed(false);
        startTransition(async () => {
          const result = await setSeen(movieId, next);
          if (result.error) {
            setSeenState(!next);
            setFailed(true);
          }
        });
      }}
    >
      {seen ? "✓ Seen" : "Mark seen"}
    </button>
  );
}
