import { NextResponse, type NextRequest } from "next/server";
import { searchMovies, searchPeople } from "@/lib/catalog";
import { moviePath, personPath } from "@/lib/slug";

// Typeahead suggestions. Default: a few movies, then a few people, for the
// header search box. kind=people: people only, for the films-together picker.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const peopleOnly = params.get("kind") === "people";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const [movies, people] = await Promise.all([
    peopleOnly ? [] : searchMovies(q, 6),
    searchPeople(q, peopleOnly ? 8 : 4),
  ]);
  const suggestions = [
    ...movies.map((m) => ({
      kind: "movie" as const,
      id: m.tmdb_id,
      label: m.title,
      detail: m.release_year ? String(m.release_year) : null,
      image: m.poster_path,
      href: moviePath(m.tmdb_id, m.title),
    })),
    ...people.map((p) => ({
      kind: "person" as const,
      id: p.tmdb_id,
      label: p.name,
      detail: p.known_for_department,
      image: p.profile_path,
      href: personPath(p.tmdb_id, p.name),
    })),
  ];
  // Login required, so never cached on the shared CDN, only in this browser.
  // The search functions themselves are cached on the server (lib/catalog.ts).
  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "private, max-age=600" } });
}
