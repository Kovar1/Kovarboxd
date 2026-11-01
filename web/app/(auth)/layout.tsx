import { AuthHeader } from "@/components/SiteChrome";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AuthHeader />
      <main className="auth-page">{children}</main>
    </>
  );
}
