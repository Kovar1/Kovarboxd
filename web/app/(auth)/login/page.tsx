import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/AuthForms";
import { safeNext } from "@/lib/auth-routes";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default function LoginPage({ searchParams }: Props) {
  return (
    <>
      <h1>Log in</h1>
      <p className="sub">Kovarboxd is invite-only. It uses the same accounts as AMC Assistant.</p>
      {/* ?next= (where to go after logging in) is request-time data. */}
      <Suspense fallback={<LoginForm next="/" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Login({ searchParams }: Props) {
  const { next, error } = await searchParams;
  return <LoginForm next={safeNext(next)} linkError={error === "link"} />;
}
