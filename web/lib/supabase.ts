import "server-only";
import { createClient } from "@supabase/supabase-js";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * Read-only client for the kovarboxd catalog, using the anon key. RLS lets it
 * read the catalog tables (movies, genres, people, credits) and nothing else.
 * It carries no user session, so it works inside "use cache" functions.
 */
export function catalogDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  return createClient(url, key, NO_SESSION).schema("kovarboxd");
}

/**
 * Service-role client. Bypasses RLS, server-only. Used for exactly one call:
 * kovarboxd.save_person_details. Returns null when the key isn't configured,
 * in which case person details are shown but not saved.
 */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, NO_SESSION).schema("kovarboxd");
}
