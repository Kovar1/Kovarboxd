import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PeoplePicker } from "@/components/PeoplePicker";
import { TogetherExamples, TogetherResults } from "@/components/Together";
import { getFilmsTogether, getPeople } from "@/lib/catalog";
import { seenSummary } from "@/lib/list-rules";
import { joinNames, parsePersonIds, togetherPath } from "@/lib/together";
import { getSeenAmong } from "@/lib/user-lists";

export const metadata: Metadata = { title: "Films together" };

type Props = { searchParams: Promise<{ ids?: string | string[]; unseen?: string }> };

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
  const params = await searchParams;
  const unseenOnly = params.unseen === "1";
  const people = await getPeople(parsePersonIds(params.ids));
  const ids = people.map((p) => p.tmdb_id);
  const films = people.length >= 2 ? await getFilmsTogether(ids) : null;
  const seen = await getSeenAmong((films ?? []).map((f) => f.tmdb_id));
  const shown = films && unseenOnly ? films.filter((f) => !seen.has(f.tmdb_id)) : films;
  const summary = films && seenSummary(seen.size, films.length);

  return (
    <>
      <PeoplePicker selected={people} autoFocus={people.length < 2} unseenOnly={unseenOnly} />
      {people.length === 0 && <TogetherExamples />}
      {people.length === 1 && <p className="empty">Add at least one more person.</p>}
      {films && films.length === 0 && (
        <p className="empty">No film in Kovarboxd has all of them. Try removing someone.</p>
      )}
      {films && films.length > 0 && shown && (
        <>
          <h2>
            {films.length} {films.length === 1 ? "film" : "films"} with {joinNames(people.map((p) => p.name))}
          </h2>
          {summary && (
            <p className="seen-summary-row">
              <span>{summary}</span>
              <Link href={togetherPath(ids, !unseenOnly)} scroll={false}>
                {unseenOnly ? "Show all" : "Hide what I've seen"}
              </Link>
            </p>
          )}
          {shown.length > 0 ? (
            <TogetherResults films={shown} people={people} seen={seen} />
          ) : (
            <p className="empty">You&apos;ve seen every one of them.</p>
          )}
        </>
      )}
    </>
  );
}
