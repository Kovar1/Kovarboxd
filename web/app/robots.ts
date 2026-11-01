import type { MetadataRoute } from "next";

// Keep crawlers out until Phase 4 adds login. Crawling every person page would
// also fill the database with on-demand person details.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
