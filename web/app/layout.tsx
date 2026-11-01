import type { Metadata } from "next";
import { Footer } from "@/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kovarboxd", template: "%s | Kovarboxd" },
  description: "Every film a group of people made together.",
  // An invite-only app: nothing here is meant for search engines.
  robots: { index: false, follow: false },
};

// The header lives in the (site) and (auth) layouts: logged-in pages get
// search and "Log out", the login pages get just the name.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
