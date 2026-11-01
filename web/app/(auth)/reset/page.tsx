import type { Metadata } from "next";
import { ResetForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <>
      <h1>Reset password</h1>
      <p className="sub">We&apos;ll email you a link to set a new one.</p>
      <ResetForm />
    </>
  );
}
