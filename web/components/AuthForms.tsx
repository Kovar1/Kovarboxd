"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, requestPasswordReset, signup, updatePassword } from "@/lib/auth-actions";

export function LoginForm({ next, linkError = false }: { next: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <>
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        <button className="button" disabled={pending}>
          {pending ? "Logging in..." : "Log in"}
        </button>
        {state?.error && <p className="form-error">{state.error}</p>}
        {!state && linkError && (
          <p className="form-error">
            That link didn&apos;t work. It may have expired, been used already, or been opened in a different browser
            from the one that asked for it.
          </p>
        )}
      </form>
      <p className="form-links">
        <Link href="/reset">Forgot password?</Link>
        <Link href="/signup">Create an account</Link>
      </p>
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, null);
  return (
    <>
      <form action={action} className="auth-form">
        <input name="email" type="email" placeholder="Email you were invited with" required autoComplete="email" />
        <input
          name="password"
          type="password"
          placeholder="Password (8+ characters)"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <button className="button" disabled={pending}>
          {pending ? "Creating..." : "Create account"}
        </button>
        {state?.error && <p className="form-error">{state.error}</p>}
        {state?.message && <p className="form-message">{state.message}</p>}
      </form>
      <p className="form-links">
        <span>
          Already have an account? <Link href="/login">Log in</Link>
        </span>
      </p>
    </>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <>
      <form action={action} className="auth-form">
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <button className="button" disabled={pending}>
          {pending ? "Sending..." : "Send reset link"}
        </button>
        {state?.error && <p className="form-error">{state.error}</p>}
        {state?.message && <p className="form-message">{state.message}</p>}
      </form>
      <p className="form-links">
        <Link href="/login">Back to log in</Link>
      </p>
    </>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="auth-form">
      <input
        name="password"
        type="password"
        placeholder="New password (8+ characters)"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <button className="button" disabled={pending}>
        {pending ? "Saving..." : "Save password"}
      </button>
      {state?.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}
