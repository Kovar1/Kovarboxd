"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/auth-client";
import { safeNext, type AuthState } from "@/lib/auth-routes";

// Accounts, the invite list and the 25 account cap are shared with
// AMC-Assistant: both apps use the same Supabase project, and the invite
// trigger on auth.users (AMC-Assistant migration 0003) blocks every signup
// that isn't on public.allowed_users.

/** This site's own address, for links in emails: production, a preview, or localhost. */
async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  if (origin) return origin;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  return "http://localhost:3000";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }

  const supabase = await createAuthClient();
  // Friendly pre-check. The trigger on auth.users is the real enforcement.
  const { data: allowed } = await supabase.rpc("invite_check", { check_email: email });
  if (allowed === false) return { error: "That email isn't on the invite list yet." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/` },
  });
  if (error) {
    // The trigger's exceptions (invite list, account cap) come back as a generic database error.
    if (/database error/i.test(error.message) || /allow|invite|not.*permitted/i.test(error.message)) {
      return { error: "Signup was blocked. If you were invited, ask whoever invited you." };
    }
    return { error: error.message };
  }
  if (data.session) redirect("/"); // email confirmation is off: straight in
  return { message: "Check your email to confirm your account, then log in." };
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = await createAuthClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/update-password`,
  });
  // The same answer either way, so this can't be used to find out who has an account.
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
