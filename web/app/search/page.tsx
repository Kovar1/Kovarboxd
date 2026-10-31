import type { Metadata } from "next";
import { Suspense } from "react";
import { MovieGrid } from "@/components/MovieGrid";
import { PersonList } from "@/components/PersonList";
import { SearchBox } from "@/components/SearchBox";
import { searchMovies, searchPeople } from "@/lib/catalog";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// The query string is request-time data, so the results stream in inside
// Suspense while the rest of the page comes from the static shell.
export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p className="empty">Searching...</p>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 100);

  if (q.length < 2) {
    return (
      <>
        <h1>Search</h1>
        <div className="search-page-box">
          <SearchBox autoFocus />
        </div>
        <p className="empty">Type at least two letters.</p>
      </>
    );
  }

  const [movies, people] = await Promise.all([searchMovies(q, 30), searchPeople(q, 20)]);
  return (
    <>
      <h1>Results for &ldquo;{q}&rdquo;</h1>
      <div className="search-page-box">
        <SearchBox key={q} initialQuery={q} />
      </div>
      {!movies.length && !people.length && <p className="empty">Nothing found. Check the spelling, or try fewer words.</p>}
      {people.length > 0 && (
        <>
          <h2>People</h2>
          <PersonList people={people} />
        </>
      )}
      {movies.length > 0 && (
        <>
          <h2>Movies</h2>
          <MovieGrid movies={movies} />
        </>
      )}
    </>
  );
}
