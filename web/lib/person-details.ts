import "server-only";
import { adminDb, catalogDb } from "./supabase";
import type { PersonDetails } from "./types";

// Person details (biography, birthday, deathday, place of birth) aren't
// loaded by the pipeline. They're fetched from TMDb and saved when someone
// actually opens a person page (see app/api/person/[id]/details), not while a
// page renders, so link prefetches and crawlers never trigger it.

export const PERSON_DETAILS_MAX_AGE_DAYS = 30;

export function detailsAreStale(fetchedAt: string | null, now = Date.now()): boolean {
  if (!fetchedAt) return true;
  return now - Date.parse(fetchedAt) > PERSON_DETAILS_MAX_AGE_DAYS * 86_400_000;
}

/** What's stored for a person, or null when there's no such person. */
export async function readStoredDetails(id: number): Promise<{ details: PersonDetails; fetchedAt: string | null } | null> {
  const { data, error } = await catalogDb()
    .from("people")
    .select("biography, birthday, deathday, place_of_birth, details_fetched_at")
    .eq("tmdb_id", id)
    .maybeSingle();
  if (error) throw new Error(`person ${id}: ${error.message}`);
  if (!data) return null;
  const { details_fetched_at, ...details } = data as PersonDetails & { details_fetched_at: string | null };
  return { details, fetchedAt: details_fetched_at };
}

export async function fetchPersonDetails(id: number): Promise<PersonDetails | null> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/person/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
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
    // TMDb being slow or down shouldn't break the page: show what's stored.
    return null;
  }
}

/**
 * Saves through kovarboxd.save_person_details. Returns false when nothing was
 * saved: no service role key, the person doesn't exist, or the schema is at
 * 95% of its size budget (the function refuses then).
 */
export async function savePersonDetails(id: number, d: PersonDetails): Promise<boolean> {
  const db = adminDb();
  if (!db) return false;
  const { data, error } = await db.rpc("save_person_details", {
    person_id: id,
    new_biography: d.biography,
    new_birthday: d.birthday,
    new_deathday: d.deathday,
    new_place_of_birth: d.place_of_birth,
  });
  if (error) {
    console.error(`save_person_details ${id}: ${error.message}`);
    return false;
  }
  return data === true;
}
