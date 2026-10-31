import { describe, expect, it } from "vitest";
import tmdbImageLoader from "@/lib/tmdb-image-loader";

describe("tmdbImageLoader", () => {
  it("rounds the width up to a TMDb size", () => {
    expect(tmdbImageLoader({ src: "/abc.jpg", width: 92 })).toBe("https://image.tmdb.org/t/p/w92/abc.jpg");
    expect(tmdbImageLoader({ src: "/abc.jpg", width: 100 })).toBe("https://image.tmdb.org/t/p/w154/abc.jpg");
    expect(tmdbImageLoader({ src: "/abc.jpg", width: 640 })).toBe("https://image.tmdb.org/t/p/w780/abc.jpg");
  });

  it("uses the original above the largest size", () => {
    expect(tmdbImageLoader({ src: "/abc.jpg", width: 3840 })).toBe("https://image.tmdb.org/t/p/original/abc.jpg");
  });

  it("gives different URLs for small and large widths, so srcset works", () => {
    expect(tmdbImageLoader({ src: "/a.jpg", width: 64 })).not.toBe(tmdbImageLoader({ src: "/a.jpg", width: 1080 }));
  });
});
