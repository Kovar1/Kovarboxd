import type { FilmCredit, MovieDetail, MovieSummary } from "./types";

// The crew jobs the pipeline keeps (pipeline/config.py CREW_JOBS), in the
// order the movie page lists them.
export const CREW_JOB_ORDER = [
  "Director",
  "Screenplay",
  "Writer",
  "Story",
  "Novel",
  "Producer",
  "Director of Photography",
  "Original Music Composer",
  "Editor",
  "Casting",
];

type MovieCredit = MovieDetail["credits"][number];

export function castOf(credits: MovieCredit[]): MovieCredit[] {
  return credits
    .filter((c) => c.kind === "cast")
    .sort((a, b) => (a.cast_order ?? 9999) - (b.cast_order ?? 9999));
}

/** Crew grouped by job in CREW_JOB_ORDER, each person once per job. */
export function crewByJob(credits: MovieCredit[]): { job: string; people: MovieCredit["person"][] }[] {
  const groups = new Map<string, MovieCredit["person"][]>();
  for (const c of credits) {
    if (c.kind !== "crew" || !c.job) continue;
    const people = groups.get(c.job) ?? [];
    if (!people.some((p) => p.tmdb_id === c.person.tmdb_id)) people.push(c.person);
    groups.set(c.job, people);
  }
  const rank = (job: string) => {
    const i = CREW_JOB_ORDER.indexOf(job);
    return i === -1 ? CREW_JOB_ORDER.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([job, people]) => ({ job, people }));
}

export type FilmographyRow = {
  movie: FilmCredit["movie"];
  /** Characters for acting rows, jobs for crew rows. */
  roles: string[];
};

/** Newest first, with unreleased movies (no date) at the top. */
function byReleaseDesc(a: FilmographyRow, b: FilmographyRow): number {
  const da = a.movie.release_date;
  const db = b.movie.release_date;
  if (da === db) return a.movie.title.localeCompare(b.movie.title);
  if (!da) return -1;
  if (!db) return 1;
  return da < db ? 1 : -1;
}

/** One row per movie, roles merged, for the acting and the crew sections. */
export function filmography(credits: FilmCredit[]): { acting: FilmographyRow[]; crew: FilmographyRow[] } {
  const acting = new Map<number, FilmographyRow>();
  const crew = new Map<number, FilmographyRow>();
  for (const c of credits) {
    const rows = c.kind === "cast" ? acting : crew;
    const role = c.kind === "cast" ? c.character : c.job;
    const row = rows.get(c.movie.tmdb_id) ?? { movie: c.movie, roles: [] };
    if (role && !row.roles.includes(role)) row.roles.push(role);
    rows.set(c.movie.tmdb_id, row);
  }
  return {
    acting: [...acting.values()].sort(byReleaseDesc),
    crew: [...crew.values()].sort(byReleaseDesc),
  };
}

/** The person's most popular movies, any role. */
export function knownFor(credits: FilmCredit[], count = 8): MovieSummary[] {
  const movies = new Map<number, MovieSummary>();
  for (const c of credits) movies.set(c.movie.tmdb_id, c.movie);
  return [...movies.values()]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, count);
}
