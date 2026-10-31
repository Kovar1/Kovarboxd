import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MovieGrid } from "@/components/MovieGrid";
import { PersonList } from "@/components/PersonList";
import { SearchBox } from "@/components/SearchBox";
import { searchMovies, searchPeople } from "@/lib/catalog";
import { strongNameMatch } from "@/lib/search";
import { splitPeopleQuery, togetherPath } from "@/lib/together";

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

  // "adam driver, scarlet johanson": offer films together when every name
  // matches someone. Only offered, never redirected to, because titles have
  // commas too ("Crouching Tiger, Hidden Dragon").
  const names = splitPeopleQuery(q);
  const [movies, people, namedPeople] = await Promise.all([
    searchMovies(q, 30),
    searchPeople(q, 20),
    Promise.all(names.map((name) => searchPeople(name, 1))),
  ]);
  const together = namedPeople.every((match) => match.length) ? namedPeople.map((match) => match[0]) : [];

  const peopleSection = people.length > 0 && (
    <section key="people">
      <h2>People</h2>
      <PersonList people={people} />
    </section>
  );
  const movieSection = movies.length > 0 && (
    <section key="movies">
      <h2>Movies</h2>
      <MovieGrid movies={movies} />
    </section>
  );
  // Movies first, unless the query is clearly someone's name ("tom han").
  const peopleFirst = people.length > 0 && strongNameMatch(q, people[0].name);

  return (
    <>
      <h1>Results for &ldquo;{q}&rdquo;</h1>
      <div className="search-page-box">
        <SearchBox key={q} initialQuery={q} />
      </div>
      {together.length >= 2 && (
        <Link href={togetherPath(together.map((p) => p.tmdb_id))} className="together-offer">
          <span className="together-offer-label">Films together</span>
          <span className="together-offer-names">{together.map((p) => p.name).join(" + ")}</span>
          <span className="together-offer-go">See every film they made together</span>
        </Link>
      )}
      {!movies.length && !people.length && !together.length && (
        <p className="empty">Nothing found. Check the spelling, or try fewer words.</p>
      )}
      {peopleFirst ? [peopleSection, movieSection] : [movieSection, peopleSection]}
    </>
  );
}
