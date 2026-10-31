import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { MovieGrid } from "@/components/MovieGrid";
import { PersonFacts } from "@/components/PersonFacts";
import { TmdbImage } from "@/components/TmdbImage";
import { getPerson, getPopularMovies, getMovie } from "@/lib/catalog";
import { filmography, knownFor, type FilmographyRow } from "@/lib/credits";
import { moviePath, parseIdParam, personPath } from "@/lib/slug";

type Props = { params: Promise<{ id: string }> };

// Pre-build the directors of the most popular movies, so at least one sample
// exists at build time. Everyone else renders on first visit, then is cached.
export async function generateStaticParams() {
  const movies = await getPopularMovies(5);
  const params = new Map<number, string>();
  for (const m of movies) {
    const movie = await getMovie(m.tmdb_id);
    for (const c of movie?.credits ?? []) {
      if (c.job === "Director") params.set(c.person.tmdb_id, personPath(c.person.tmdb_id, c.person.name));
    }
  }
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

function Filmography({ title, rows, rolePrefix }: { title: string; rows: FilmographyRow[]; rolePrefix?: string }) {
  if (!rows.length) return null;
  return (
    <>
      <h2>
        {title} <span className="count">{rows.length}</span>
      </h2>
      <ol className="filmography">
        {rows.map(({ movie, roles }) => (
          <li key={movie.tmdb_id}>
            <span className="film-year">{movie.release_year ?? "TBA"}</span>
            <span className="film-main">
              <Link href={moviePath(movie.tmdb_id, movie.title)}>{movie.title}</Link>
              {roles.length > 0 && (
                <span className="film-role">
                  {rolePrefix}
                  {roles.join(", ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

export default async function PersonPage({ params }: Props) {
  const { raw, person } = await load(params);
  if (!person) notFound();
  const canonical = personPath(person.tmdb_id, person.name);
  if (`/person/${raw}` !== canonical) permanentRedirect(canonical);

  const { acting, crew } = filmography(person.credits);
  // Acting first for actors, crew first for directors, writers and the rest.
  const crewFirst = person.known_for_department && person.known_for_department !== "Acting";
  const sections = [
    <Filmography key="acting" title="Acting" rows={acting} rolePrefix="as " />,
    <Filmography key="crew" title="Crew" rows={crew} />,
  ];

  return (
    <article className="person">
      <div className="title-block">
        <TmdbImage path={person.profile_path} alt={person.name} width={300} aspect="profile" priority className="title-poster" />
        <div className="title-text">
          <h1>{person.name}</h1>
          {person.known_for_department && <p className="facts">Known for {person.known_for_department}</p>}
          <PersonFacts
            id={person.tmdb_id}
            initial={{
              biography: person.biography,
              birthday: person.birthday,
              deathday: person.deathday,
              place_of_birth: person.place_of_birth,
            }}
            stale={person.details_stale}
            asOf={person.as_of}
          />
          <p className="ext-links">
            <a href={`https://www.themoviedb.org/person/${person.tmdb_id}`} target="_blank" rel="noreferrer">
              TMDB
            </a>
          </p>
        </div>
      </div>

      {person.credits.length > 0 && (
        <>
          <h2>Known for</h2>
          <MovieGrid movies={knownFor(person.credits)} />
        </>
      )}
      {crewFirst ? sections.reverse() : sections}
    </article>
  );
}
