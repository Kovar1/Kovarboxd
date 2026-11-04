// Shapes and small helpers for the insights page. Pure, so they're unit tested.

export type Bar = { label: string; count: number; href?: string };

export type Insights = {
  total: number;
  minutes: number;
  watchlist: number;
  by_decade: { label: string; count: number }[];
  by_year_seen: { label: string; count: number }[];
  genres: { label: string; count: number }[];
  directors: { id: number; label: string; count: number }[];
  actors: { id: number; label: string; count: number }[];
  pairs: { ids: [number, number]; label: string; count: number }[];
};

/** A bar's length as a share of the longest in its chart. */
export function barPercent(count: number, max: number): number {
  return max > 0 ? Math.max((count / max) * 100, 1) : 0;
}

/** 7265 minutes becomes "121". Under an hour rounds up, so any viewing shows as at least 1. */
export function hoursWatched(minutes: number): string {
  if (minutes <= 0) return "0";
  return Math.ceil(minutes / 60).toLocaleString("en-US");
}
