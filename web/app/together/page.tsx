import type { Metadata } from "next";
import { Suspense } from "react";
import { PeoplePicker } from "@/components/PeoplePicker";
import { TogetherExamples, TogetherResults } from "@/components/Together";
import { getFilmsTogether, getPeople } from "@/lib/catalog";
import { joinNames, parsePersonIds } from "@/lib/together";

export const metadata: Metadata = { title: "Films together" };

type Props = { searchParams: Promise<{ ids?: string | string[] }> };

export default function TogetherPage({ searchParams }: Props) {
  return (
    <section className="together">
      <h1>Films together</h1>
      <p className="sub">
        Pick two or more people to see every film they all worked on, in front of or behind the camera.
      </p>
      {/* The chosen people come from the URL, which is request-time data. */}
      <Suspense fallback={<PeoplePicker selected={[]} />}>
        <Together searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Together({ searchParams }: Props) {
  const people = await getPeople(parsePersonIds((await searchParams).ids));
  const films = people.length >= 2 ? await getFilmsTogether(people.map((p) => p.tmdb_id)) : null;

  return (
    <>
      <PeoplePicker selected={people} autoFocus={people.length < 2} />
      {people.length === 0 && <TogetherExamples />}
      {people.length === 1 && <p className="empty">Add at least one more person.</p>}
      {films && films.length === 0 && (
        <p className="empty">No film in Kovarboxd has all of them. Try removing someone.</p>
      )}
      {films && films.length > 0 && (
        <>
          <h2>
            {films.length} {films.length === 1 ? "film" : "films"} with {joinNames(people.map((p) => p.name))}
          </h2>
          <TogetherResults films={films} people={people} />
        </>
      )}
    </>
  );
}
