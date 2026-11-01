import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Set a new password" };

// Reached from the reset email: /auth/confirm checks the link, logs the person
// in, and sends them here.
export default function UpdatePasswordPage() {
  return (
    <>
      <h1>Set a new password</h1>
      <UpdatePasswordForm />
    </>
  );
}
