import { NextResponse, type NextRequest } from "next/server";
import { searchMovies, searchPeople } from "@/lib/catalog";
import { moviePath, personPath } from "@/lib/slug";

// Typeahead suggestions for the search box: a few movies, then a few people.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const [movies, people] = await Promise.all([searchMovies(q, 6), searchPeople(q, 4)]);
  const suggestions = [
    ...movies.map((m) => ({
      kind: "movie" as const,
      id: m.tmdb_id,
      label: m.title,
      detail: m.release_year ? String(m.release_year) : null,
      href: moviePath(m.tmdb_id, m.title),
    })),
    ...people.map((p) => ({
      kind: "person" as const,
      id: p.tmdb_id,
      label: p.name,
      detail: p.known_for_department,
      href: personPath(p.tmdb_id, p.name),
    })),
  ];
  // The catalog changes nightly, so the CDN can serve repeat queries.
  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
