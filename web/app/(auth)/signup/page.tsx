import type { Metadata } from "next";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <h1>Create an account</h1>
      <p className="sub">
        Only invited emails can sign up. If you already have an AMC Assistant account, just log in with it.
      </p>
      <SignupForm />
    </>
  );
}
