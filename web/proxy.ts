import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authRedirect, isApiPath } from "@/lib/auth-routes";

/**
 * Runs before every page and API request (Next 16's "proxy", formerly
 * "middleware"): refreshes the Supabase session cookie and keeps logged-out
 * visitors out. Pages redirect to /login, which returns them to where they
 * were going. API routes answer 401.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Nothing may run between creating the client and getUser(), or sessions
  // can randomly drop (Supabase's guidance for @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && isApiPath(pathname)) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }

  const dest = authRedirect(pathname, !!user);
  if (!dest) return response;

  const url = request.nextUrl.clone();
  url.pathname = dest;
  url.search = "";
  if (dest === "/login" && pathname !== "/") url.searchParams.set("next", pathname + search);
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed session cookies, or the redirect would log people out.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next's own files and static assets.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
