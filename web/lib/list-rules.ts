// Pure rules for the seen and watchlist features, so they're unit tested.

export const LIST_NAMES = ["seen", "watchlist"] as const;
export type ListName = (typeof LIST_NAMES)[number];

export type MovieStatus = { seen: boolean; seenOn: string | null; watchlist: boolean };

export function isValidMovieId(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) > 0;
}

/** "2026-10-31" if it's a real calendar date, otherwise null (including empty input). */
export function parseSeenDate(input: unknown): string | null {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00Z`);
  // new Date rolls Feb 31 over to March, so check it came back unchanged.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input ? input : null;
}

/** "2 of 4" or "All 4", for the You've seen row. */
export function seenLabel(seen: number, total: number): string {
  return seen === total && total > 1 ? `All ${total}` : `${seen} of ${total}`;
}

/** Splits ids into groups small enough for one request's URL. */
export function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
