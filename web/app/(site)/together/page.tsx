import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BoxLabel, Burst, Slab } from "@/components/Jumpsuit";
import { PeoplePicker } from "@/components/PeoplePicker";
import { TogetherExamples, TogetherResults } from "@/components/Together";
import { getFilmsTogether, getPeople } from "@/lib/catalog";
import { seenLabel } from "@/lib/list-rules";
import { personPath } from "@/lib/slug";
import { MAX_PEOPLE, parsePersonIds, togetherPath } from "@/lib/together";
import { getSeenAmong } from "@/lib/user-lists";

export const metadata: Metadata = { title: "Films together" };

type Props = { searchParams: Promise<{ ids?: string | string[]; unseen?: string }> };

const INTRO = "Pick two or more people to see every film they all worked on, in front of or behind the camera.";

export default function TogetherPage({ searchParams }: Props) {
  return (
    <div className="p-together">
      {/* The chosen people come from the URL, which is request-time data. */}
      <Suspense
        fallback={
          <section className="hero">
            <Slab>
              <h1 className="big m cutT">Films together</h1>
              <p>{INTRO}</p>
              <PeoplePicker selected={[]} />
            </Slab>
          </section>
        }
      >
        <Together searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function yearRange(years: (number | null)[]): string | null {
  const known = years.filter((y): y is number => y !== null);
  if (!known.length) return null;
  const [low, high] = [Math.min(...known), Math.max(...known)];
  return low === high ? String(low) : `${low} to ${high}`;
}

async function Together({ searchParams }: Props) {
  const params = await searchParams;
  const unseenOnly = params.unseen === "1";
  const people = await getPeople(parsePersonIds(params.ids));
  const ids = people.map((p) => p.tmdb_id);
  const films = people.length >= 2 ? await getFilmsTogether(ids) : null;
  const seen = await getSeenAmong((films ?? []).map((f) => f.tmdb_id));
  const shown = films && unseenOnly ? films.filter((f) => !seen.has(f.tmdb_id)) : films;
  const none = people.length === 0;

  return (
    <>
      <section className="hero">
        <Slab>
          <h1 className={none ? "big m cutT" : "sr-only"}>Films together</h1>
          {none && <p>{INTRO}</p>}
          <PeoplePicker selected={people} autoFocus={people.length < 2} unseenOnly={unseenOnly} />
          {none && <TogetherExamples />}
          {people.length === 1 && <p>Add at least one more person.</p>}
          {films && films.length === 0 && <p>No film in Kovarboxd has all of them. Try removing someone.</p>}
        </Slab>
        <div className="hero-side">
          {none && (
            <>
              <Burst value="2+" />
              <BoxLabel
                rows={[
                  ["Pick at least", "2 people"],
                  ["Up to", `${MAX_PEOPLE} people`],
                ]}
              />
            </>
          )}
          {people.length === 1 && (
            <>
              <Burst value="+1" />
              <Link className="btn line" href={personPath(people[0].tmdb_id, people[0].name)}>
                See their films
              </Link>
            </>
          )}
          {films && (
            <>
              <Burst value={films.length} />
              <BoxLabel
                rows={[
                  ["Films together", films.length],
                  ["People", people.length],
                  ["Years", yearRange(films.map((f) => f.release_year))],
                  ["You've seen", films.length ? seenLabel(seen.size, films.length) : null],
                ]}
              />
              {films.length > 0 && seen.size > 0 && (
                <Link className="link" href={togetherPath(ids, !unseenOnly)} scroll={false}>
                  {unseenOnly ? "Show all" : "Hide what I've seen"}
                </Link>
              )}
            </>
          )}
        </div>
      </section>
      {shown && shown.length > 0 && <TogetherResults films={shown} people={people} seen={seen} />}
      {films && films.length > 0 && shown?.length === 0 && <p className="empty">You&apos;ve seen every one of them.</p>}
    </>
  );
}
