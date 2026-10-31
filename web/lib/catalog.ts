import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { detailsAreStale } from "./person-details";
import { catalogDb } from "./supabase";
import type { FilmCredit, MovieDetail, MovieSummary, PersonDetail, PersonSummary } from "./types";

// Every read here is cached for hours: the catalog only changes when the
// nightly sync runs. A miss costs one Data API round trip.

const MOVIE_SUMMARY = "tmdb_id, title, release_year, poster_path, popularity";

export async function getPopularMovies(limit = 24): Promise<MovieSummary[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await catalogDb()
    .from("movies")
    .select(MOVIE_SUMMARY)
    .order("popularity", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`popular movies: ${error.message}`);
  return data as MovieSummary[];
}

export async function getMovie(id: number): Promise<MovieDetail | null> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await catalogDb()
    .from("movies")
    .select(
      `tmdb_id, imdb_id, title, original_title, original_language, release_date, release_year,
       runtime, overview, tagline, poster_path, backdrop_path, popularity, vote_average,
       vote_count, budget, revenue, status,
       movie_genres ( genres ( id, name ) ),
       credits ( credit_id, kind, character, cast_order, department, job,
                 people ( tmdb_id, name, profile_path ) )`,
    )
    .eq("tmdb_id", id)
    .maybeSingle();
  if (error) throw new Error(`movie ${id}: ${error.message}`);
  if (!data) return null;

  // Without generated types supabase-js types every embed as an array, but
  // genres and people here are many-to-one, so they arrive as single objects.
  const { movie_genres, credits, ...movie } = data as unknown as Record<string, unknown> & {
    movie_genres: { genres: { id: number; name: string } }[];
    credits: (Omit<MovieDetail["credits"][number], "person"> & { people: MovieDetail["credits"][number]["person"] })[];
  };
  return {
    ...(movie as Omit<MovieDetail, "genres" | "credits">),
    genres: movie_genres.map((g) => g.genres).sort((a, b) => a.name.localeCompare(b.name)),
    credits: credits.map(({ people, ...c }) => ({ ...c, person: people })),
  };
}

export async function getPerson(id: number): Promise<PersonDetail | null> {
  "use cache";
  cacheLife("hours");
  // Lets /api/person/[id]/details refresh this entry after saving new details.
  cacheTag(`person-${id}`);
  const { data, error } = await catalogDb()
    .from("people")
    .select(
      `tmdb_id, name, profile_path, known_for_department, gender, popularity,
       biography, birthday, deathday, place_of_birth, details_fetched_at,
       credits ( credit_id, kind, character, cast_order, department, job,
                 movies!inner ( tmdb_id, title, release_date, release_year, poster_path, popularity ) )`,
    )
    .eq("tmdb_id", id)
    .maybeSingle();
  if (error) throw new Error(`person ${id}: ${error.message}`);
  if (!data) return null;

  const { credits, details_fetched_at, ...person } = data as unknown as Record<string, unknown> & {
    details_fetched_at: string | null;
    credits: (Omit<FilmCredit, "movie"> & { movies: FilmCredit["movie"] })[];
  };
  return {
    ...(person as Omit<PersonDetail, "credits" | "details_stale" | "as_of">),
    credits: credits.map(({ movies, ...c }) => ({ ...c, movie: movies })),
    // Read the clock here, inside the cache, so the page itself stays static.
    details_stale: detailsAreStale(details_fetched_at),
    as_of: new Date().toISOString().slice(0, 10),
  };
}

export async function searchMovies(q: string, limit = 20): Promise<MovieSummary[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await catalogDb().rpc("search_movies", { q, max_results: limit });
  if (error) throw new Error(`search movies: ${error.message}`);
  return data as MovieSummary[];
}

export async function searchPeople(q: string, limit = 20): Promise<PersonSummary[]> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await catalogDb().rpc("search_people", { q, max_results: limit });
  if (error) throw new Error(`search people: ${error.message}`);
  return data as PersonSummary[];
}
