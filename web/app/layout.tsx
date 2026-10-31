import type { Metadata } from "next";
import { Footer, Header } from "@/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kovarboxd", template: "%s | Kovarboxd" },
  description: "Search movies and the people who make them.",
  // Not for search engines until Phase 4 puts the app behind a login.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
