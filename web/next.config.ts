import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Catalog data changes once a night, so pages are cached with "use cache"
  // and rebuilt in the background (see lib/catalog.ts).
  cacheComponents: true,
  images: {
    // Images come straight from TMDb's CDN in its standard sizes, so Vercel's
    // image optimization (and its quota) isn't used.
    loader: "custom",
    loaderFile: "./lib/tmdb-image-loader.ts",
  },
};

export default nextConfig;
