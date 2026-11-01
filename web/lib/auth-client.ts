import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client that carries the visitor's login, for Server Components,
 * Server Actions and Route Handlers. Reads and refreshes the session cookie.
 * Catalog reads don't use this (see lib/supabase.ts): they're the same for
 * everyone, so they stay cacheable.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies. The proxy
          // refreshes the session on every request, so this is safe to skip.
        }
      },
    },
  });
}
