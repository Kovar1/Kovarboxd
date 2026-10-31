// Films together: every movie a set of people all have a credit on.
// The URL carries the people as TMDb ids, /together?ids=1032,380,4517, so a
// search can be shared or bookmarked.

export const MAX_PEOPLE = 6;

/** "1032,380,4517" to [1032, 380, 4517]: numbers only, no repeats, at most MAX_PEOPLE. */
export function parsePersonIds(raw: string | string[] | undefined): number[] {
  const text = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const ids: number[] = [];
  for (const part of text.split(",")) {
    if (!/^\d{1,9}$/.test(part.trim())) continue;
    const id = Number(part.trim());
    if (id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_PEOPLE);
}

/**
 * A search like "adam driver, scarlet johanson" (or with + or &) split into
 * names, so the search page can offer films together. Parts under 3
 * characters are ignored, as people search ignores them.
 */
export function splitPeopleQuery(q: string): string[] {
  if (!/[,+&]/.test(q)) return [];
  return q
    .split(/[,+&]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, MAX_PEOPLE);
}

export function togetherPath(ids: number[]): string {
  return ids.length ? `/together?ids=${ids.join(",")}` : "/together";
}

export type RoleRow = {
  person_id: number;
  movie_id: number;
  kind: "cast" | "crew";
  character: string | null;
  job: string | null;
};

/**
 * What each person did on each movie: movie id to person id to roles, like
 * "as Nicky Santoro" for cast and "Director" for crew. Acting comes first.
 */
export function rolesByMovie(rows: RoleRow[]): Map<number, Map<number, string[]>> {
  const sorted = [...rows].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "cast" ? -1 : 1));
  const byMovie = new Map<number, Map<number, string[]>>();
  for (const r of sorted) {
    const role = r.kind === "cast" ? (r.character ? `as ${r.character}` : "Cast") : r.job;
    if (!role) continue;
    const people = byMovie.get(r.movie_id) ?? new Map<number, string[]>();
    const roles = people.get(r.person_id) ?? [];
    if (!roles.includes(role)) roles.push(role);
    people.set(r.person_id, roles);
    byMovie.set(r.movie_id, people);
  }
  return byMovie;
}

/** "Martin Scorsese, Robert De Niro and Joe Pesci" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
