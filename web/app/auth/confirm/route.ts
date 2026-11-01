import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/auth-routes";

/**
 * Where links in password-reset (and signup-confirmation) emails land. Logs
 * the person in from the link, then sends them on to `next`.
 *
 * Two link styles:
 * - `?code=`: what Supabase's default email templates produce. The link goes
 *   to Supabase first, which sends the browser here with a one-time code to
 *   exchange. It only works in the browser that asked for the email, because
 *   the exchange needs a cookie set at that moment. This project uses the
 *   default templates (editing them needs custom SMTP).
 * - `?token_hash=&type=`: what custom templates built on {{ .TokenHash }}
 *   produce. Works in any browser. Kept in case the templates change.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));

  const supabase = await createAuthClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
