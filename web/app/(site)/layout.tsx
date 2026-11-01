import { Header } from "@/components/SiteChrome";

// Every page in this group needs a login; proxy.ts sends visitors without
// one to /login first.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}
