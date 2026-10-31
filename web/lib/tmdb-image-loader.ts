"use client";

// Widths TMDb's image CDN publishes. Rounding a requested width up to one of
// these keeps every image on TMDb's own cache instead of minting new sizes.
export const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780, 1280];

/** next/image loader: `src` is a TMDb image path like "/abc123.jpg". */
export default function tmdbImageLoader({ src, width }: { src: string; width: number }): string {
  const size = TMDB_WIDTHS.find((w) => w >= width);
  return `https://image.tmdb.org/t/p/${size ? `w${size}` : "original"}${src}`;
}
