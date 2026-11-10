"use client";

import { useEffect, useSyncExternalStore } from "react";

// Which films the logged-in person has seen, shared by every Seen stamp on the
// page. Pages stay cached: the ids arrive separately through <SeenHydrator>,
// and the stamps appear when they do.

let seen = new Set<number>();
const listeners = new Set<() => void>();

function publish(next: Set<number>) {
  seen = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Updates the stamps straight away when a Seen button is pressed. */
export function markSeen(id: number, on: boolean) {
  const next = new Set(seen);
  if (on) next.add(id);
  else next.delete(id);
  publish(next);
}

function useSeen(id: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => seen.has(id),
    () => false,
  );
}

export function SeenHydrator({ ids }: { ids: number[] }) {
  useEffect(() => publish(new Set(ids)), [ids]);
  return null;
}

export function SeenStamp({ id }: { id: number }) {
  return useSeen(id) ? <span className="stamp">Seen</span> : null;
}

export function SeenTag({ id }: { id: number }) {
  return useSeen(id) ? <em>Seen</em> : null;
}
