import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { bigSize, BoxLabel, Burst, SectionHead, Slab } from "@/components/Jumpsuit";
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
    <Suspense
      fallback={
        <section className="hero">
          <Slab>
            <p className="big m cutT">Searching...</p>
          </Slab>
        </section>
      }
    >
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 100);

  if (q.length < 2) {
    return (
      <section className="hero">
        <Slab>
          <h1 className="big cutT">Search</h1>
          <SearchBox autoFocus />
          <p>Type at least two letters.</p>
        </Slab>
      </section>
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
      <SectionHead title="People" />
      <PersonList people={people} />
    </section>
  );
  const movieSection = movies.length > 0 && (
    <section key="movies">
      <SectionHead title="Movies" />
      <MovieGrid movies={movies} />
    </section>
  );
  // Movies first, unless the query is clearly someone's name ("tom han").
  const peopleFirst = people.length > 0 && strongNameMatch(q, people[0].name);

  return (
    <>
      <section className="hero">
        <Slab>
          <p className="meta">Results for</p>
          <h1 className={bigSize(q)}>{q}</h1>
          <SearchBox key={q} initialQuery={q} />
        </Slab>
        <div className="hero-side">
          <Burst value={movies.length + people.length} />
          <BoxLabel
            rows={[
              ["Movies", movies.length],
              ["People", people.length],
            ]}
          />
        </div>
      </section>
      {together.length >= 2 && (
        <Link href={togetherPath(together.map((p) => p.tmdb_id))} className="offer">
          <i />
          <span>{together.map((p) => p.name).join(" + ")}</span>
          <u>See every film they made together</u>
        </Link>
      )}
      {!movies.length && !people.length && !together.length && (
        <p className="empty">Nothing found. Check the spelling, or try fewer words.</p>
      )}
      {peopleFirst ? [peopleSection, movieSection] : [movieSection, peopleSection]}
    </>
  );
}
