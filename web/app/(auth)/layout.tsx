import { BoxLabel, Burst, Slab } from "@/components/Jumpsuit";
import { AuthHeader } from "@/components/SiteChrome";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AuthHeader />
      <main className="auth">
        <Slab>{children}</Slab>
        <aside className="hero-side">
          <Burst value="Invite" />
          <BoxLabel
            rows={[
              ["Access", "Invite only"],
              ["Accounts", "Shared with AMC Assistant"],
            ]}
          />
        </aside>
      </main>
    </>
  );
}
