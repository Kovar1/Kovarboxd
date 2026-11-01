// Which routes need a login, and where to send people. Pure, so it's unit tested.
// The whole site is invite-only: everything except these pages needs a session.

export type AuthState = { error?: string; message?: string } | null;

const PUBLIC = ["/login", "/signup", "/reset", "/update-password", "/auth"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Where the proxy should send a request, or null to let it through.
 * API routes are never redirected; the proxy answers them with 401 instead.
 */
export function authRedirect(pathname: string, hasUser: boolean): string | null {
  if (isApiPath(pathname)) return null;
  if (!hasUser && !isPublicPath(pathname)) return "/login";
  if (hasUser && (pathname === "/login" || pathname === "/signup")) return "/";
  return null;
}

/**
 * A "next" path to return to after logging in, only if it's a path on this
 * site. Anything else (another site, "//evil.com", junk) falls back to "/".
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
