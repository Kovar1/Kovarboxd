import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Footer } from "@/components/SiteChrome";
import "./globals.css";

// One family carries the whole design. The width axis gives the condensed labels.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kovarboxd", template: "%s | Kovarboxd" },
  description: "Every film a group of people made together.",
  // An invite-only app: nothing here is meant for search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fab617" };

// The header lives in the (site) and (auth) layouts: logged-in pages get
// search and "Log out", the login pages get just the name.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.className}>
      <body>
        {/* Rough scissor edges, used on the few large paper shapes and big words. */}
        <svg className="defs" aria-hidden="true">
          <filter id="cut" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves={2} seed={4} />
            <feDisplacementMap in="SourceGraphic" scale={7} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="cutT" x="-2%" y="-4%" width="104%" height="108%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={9} />
            <feDisplacementMap in="SourceGraphic" scale={3.5} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="sheet">
          <div className="stripe l" />
          <div className="stripe r" />
          <div className="w">
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
