import "server-only";
import { cacheLife } from "next/cache";
import { adminDb, catalogDb } from "./supabase";
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

// Person details (biography, birthday, deathday, place of birth) aren't
// loaded by the pipeline. The first view of a person fetches them from TMDb
// and saves them, and they're refreshed after this many days.
const PERSON_DETAILS_MAX_AGE_DAYS = 30;

export async function getPerson(id: number): Promise<PersonDetail | null> {
  "use cache";
  cacheLife("hours");
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
  const result: PersonDetail = {
    ...(person as Omit<PersonDetail, "credits" | "as_of">),
    credits: credits.map(({ movies, ...c }) => ({ ...c, movie: movies })),
    // Read the clock here, inside the cache, so the page itself stays static.
    as_of: new Date().toISOString().slice(0, 10),
  };

  const ageDays = details_fetched_at ? (Date.now() - Date.parse(details_fetched_at)) / 86_400_000 : Infinity;
  if (ageDays > PERSON_DETAILS_MAX_AGE_DAYS) {
    const fresh = await fetchPersonDetails(id);
    if (fresh) {
      Object.assign(result, fresh);
      await savePersonDetails(id, fresh);
    }
  }
  return result;
}

type PersonDetails = Pick<PersonDetail, "biography" | "birthday" | "deathday" | "place_of_birth">;

async function fetchPersonDetails(id: number): Promise<PersonDetails | null> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/person/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const p = await res.json();
    return {
      biography: p.biography || null,
      birthday: p.birthday || null,
      deathday: p.deathday || null,
      place_of_birth: p.place_of_birth || null,
    };
  } catch {
    // TMDb being slow or down shouldn't break the page: show what we have.
    return null;
  }
}

async function savePersonDetails(id: number, d: PersonDetails): Promise<void> {
  const db = adminDb();
  if (!db) return;
  // Returns false (and saves nothing) once the schema is at 95% of its budget.
  const { error } = await db.rpc("save_person_details", {
    person_id: id,
    new_biography: d.biography,
    new_birthday: d.birthday,
    new_deathday: d.deathday,
    new_place_of_birth: d.place_of_birth,
  });
  if (error) console.error(`save_person_details ${id}: ${error.message}`);
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
