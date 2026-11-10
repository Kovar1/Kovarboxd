import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { CutImage } from "@/components/CutImage";
import { Filmography } from "@/components/Filmography";
import { bigSize, BoxLabel, Burst, SectionHead, Slab } from "@/components/Jumpsuit";
import { MovieGrid } from "@/components/MovieGrid";
import { PersonSeenRow } from "@/components/MyListBits";
import { PersonBio, PersonDetailsProvider, PersonLifeRows } from "@/components/PersonDetails";
import { getPerson, getPopularMovies, getMovie } from "@/lib/catalog";
import { filmography, knownFor } from "@/lib/credits";
import { parseIdParam, personPath } from "@/lib/slug";
import { togetherPath } from "@/lib/together";

type Props = { params: Promise<{ id: string }> };

// Pre-build the directors of the most popular movies, so at least one sample
// exists at build time. Everyone else renders on first visit, then is cached.
export async function generateStaticParams() {
  const params = new Map<number, string>();
  try {
    const movies = await getPopularMovies(5);
    for (const m of movies) {
      const movie = await getMovie(m.tmdb_id);
      for (const c of movie?.credits ?? []) {
        if (c.job === "Director") params.set(c.person.tmdb_id, personPath(c.person.tmdb_id, c.person.name));
      }
    }
  } catch (error) {
    // A slow database shouldn't fail the deploy: these pages build on first visit anyway.
    console.warn("Prebuilding person pages skipped:", error);
  }
  if (!params.size) params.set(1032, "/person/1032-martin-scorsese");
  return [...params.values()].map((path) => ({ id: path.slice("/person/".length) }));
}

async function load(params: Props["params"]) {
  const raw = (await params).id;
  const id = parseIdParam(raw);
  const person = id ? await getPerson(id) : null;
  return { raw, person };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { person } = await load(params);
  if (!person) return { title: "Person not found" };
  return { title: person.name, description: person.biography?.slice(0, 200) ?? undefined };
}

export default async function PersonPage({ params }: Props) {
  const { raw, person } = await load(params);
  if (!person) notFound();
  const canonical = personPath(person.tmdb_id, person.name);
  if (`/person/${raw}` !== canonical) permanentRedirect(canonical);

  const { acting, crew } = filmography(person.credits);
  const movieIds = [...new Set(person.credits.map((c) => c.movie.tmdb_id))];
  // Acting first for actors, crew first for directors, writers and the rest.
  const crewFirst = person.known_for_department && person.known_for_department !== "Acting";
  const sections = [
    <Filmography key="acting" title="Acting" rows={acting} rolePrefix="as " />,
    <Filmography key="crew" title="Crew" rows={crew} />,
  ];

  return (
    <PersonDetailsProvider
      id={person.tmdb_id}
      initial={{
        biography: person.biography,
        birthday: person.birthday,
        deathday: person.deathday,
        place_of_birth: person.place_of_birth,
      }}
      stale={person.details_stale}
    >
      <article>
        <div className="pg">
          <div>
            <Slab>
              <h1 className={bigSize(person.name)}>{person.name}</h1>
              {person.known_for_department && <p className="meta">Known for {person.known_for_department}</p>}
            </Slab>
            <div className="mg two">
              <div className="pcol">
                <CutImage id={person.tmdb_id} path={person.profile_path} alt={person.name} width={342} aspect="profile" priority />
                <div className="acts">
                  <Link href={togetherPath([person.tmdb_id])} className="btn">
                    Find films with someone else
                  </Link>
                </div>
                <p className="ext">
                  <a href={`https://www.themoviedb.org/person/${person.tmdb_id}`} target="_blank" rel="noreferrer">
                    TMDB
                  </a>
                </p>
              </div>
              <div>
                <PersonBio />
              </div>
            </div>
          </div>
          <div>
            <Burst value={movieIds.length} />
            <BoxLabel rows={[["Films in the catalog", movieIds.length]]}>
              {/* Personal, so it streams in. The rest of this page stays cached. */}
              <Suspense fallback={null}>
                <PersonSeenRow movieIds={movieIds} />
              </Suspense>
              <PersonLifeRows asOf={person.as_of} />
            </BoxLabel>
          </div>
        </div>

        {person.credits.length > 0 && (
          <>
            <SectionHead title="Known for" />
            <MovieGrid movies={knownFor(person.credits)} />
          </>
        )}
        {crewFirst ? sections.reverse() : sections}
      </article>
    </PersonDetailsProvider>
  );
}
