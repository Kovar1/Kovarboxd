import "server-only";
import { cache } from "react";
import { createAuthClient } from "./auth-client";
import { chunks, type ListName, type MovieStatus } from "./list-rules";
import type { MovieSummary } from "./types";

// Reads of the logged-in person's lists. These run with their session, so the
// database's own rules limit them to their rows. They read cookies, so they
// can never be inside "use cache": pages render them inside <Suspense>, and
// the rest of the page stays cached.

/** The person's database client and id, or null when logged out. Once per request. */
export const currentUser = cache(async () => {
  const client = await createAuthClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { db: client.schema("kovarboxd"), userId: user.id } : null;
});

export async function getMovieStatus(movieId: number): Promise<MovieStatus> {
  const me = await currentUser();
  if (!me) return { seen: false, seenOn: null, watchlist: false };
  const [seen, watchlist] = await Promise.all([
    me.db.from("seen").select("seen_on").eq("movie_id", movieId).maybeSingle(),
    me.db.from("watchlist").select("movie_id").eq("movie_id", movieId).maybeSingle(),
  ]);
  if (seen.error) throw new Error(`seen status: ${seen.error.message}`);
  if (watchlist.error) throw new Error(`watchlist status: ${watchlist.error.message}`);
  return { seen: !!seen.data, seenOn: seen.data?.seen_on ?? null, watchlist: !!watchlist.data };
}

/** Which of these movies the person has seen. */
export async function getSeenAmong(movieIds: number[]): Promise<Set<number>> {
  const me = await currentUser();
  const seen = new Set<number>();
  if (!me || !movieIds.length) return seen;
  const results = await Promise.all(
    chunks(movieIds).map((ids) => me.db.from("seen").select("movie_id").in("movie_id", ids)),
  );
  for (const { data, error } of results) {
    if (error) throw new Error(`seen among: ${error.message}`);
    for (const row of data as { movie_id: number }[]) seen.add(row.movie_id);
  }
  return seen;
}

/** Every film the person has seen, for the Seen stamps. Empty when logged out. */
export async function getSeenIds(): Promise<number[]> {
  const me = await currentUser();
  if (!me) return [];
  const ids: number[] = [];
  // The Data API returns at most 1,000 rows per request.
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await me.db
      .from("seen")
      .select("movie_id")
      .order("movie_id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`seen ids: ${error.message}`);
    const rows = data as { movie_id: number }[];
    ids.push(...rows.map((r) => r.movie_id));
    if (rows.length < pageSize) return ids;
  }
}

export type ListedMovie = MovieSummary & { seen_on: string | null };

/** Everything on one of the person's lists, most recently added first. */
export async function getMyList(list: ListName): Promise<ListedMovie[]> {
  const me = await currentUser();
  if (!me) return [];
  const columns = list === "seen" ? "seen_on, " : "";
  const movies: ListedMovie[] = [];
  // The Data API returns at most 1,000 rows per request.
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await me.db
      .from(list)
      .select(`${columns}created_at, movies!inner ( tmdb_id, title, release_year, poster_path, popularity )`)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${list} list: ${error.message}`);
    const rows = data as unknown as { seen_on?: string | null; movies: MovieSummary }[];
    movies.push(...rows.map((r) => ({ ...r.movies, seen_on: r.seen_on ?? null })));
    if (rows.length < pageSize) return movies;
  }
}

export async function getListCounts(): Promise<Record<ListName, number>> {
  const me = await currentUser();
  if (!me) return { seen: 0, watchlist: 0 };
  const [seen, watchlist] = await Promise.all(
    (["seen", "watchlist"] as const).map((list) => me.db.from(list).select("movie_id", { count: "exact", head: true })),
  );
  return { seen: seen.count ?? 0, watchlist: watchlist.count ?? 0 };
}
