import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { TmdbImage } from "@/components/TmdbImage";
import { getMovie, getPopularMovies } from "@/lib/catalog";
import { castOf, crewByJob } from "@/lib/credits";
import { formatDate, formatMoney, formatRuntime, languageName } from "@/lib/format";
import { moviePath, parseIdParam, personPath } from "@/lib/slug";

type Props = { params: Promise<{ id: string }> };

// Build the most popular movies ahead of time. Every other movie renders on
// its first visit and is cached after that.
export async function generateStaticParams() {
  const movies = await getPopularMovies(20);
  return movies.map((m) => ({ id: moviePath(m.tmdb_id, m.title).slice("/movie/".length) }));
}

async function load(params: Props["params"]) {
  const raw = (await params).id;
  const id = parseIdParam(raw);
  const movie = id ? await getMovie(id) : null;
  return { raw, movie };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { movie } = await load(params);
  if (!movie) return { title: "Movie not found" };
  return {
    title: movie.release_year ? `${movie.title} (${movie.release_year})` : movie.title,
    description: movie.overview ?? undefined,
  };
}

export default async function MoviePage({ params }: Props) {
  const { raw, movie } = await load(params);
  if (!movie) notFound();
  const canonical = moviePath(movie.tmdb_id, movie.title);
  if (`/movie/${raw}` !== canonical) permanentRedirect(canonical);

  const cast = castOf(movie.credits);
  const crew = crewByJob(movie.credits);
  const facts = [
    formatDate(movie.release_date),
    formatRuntime(movie.runtime),
    movie.genres.map((g) => g.name).join(", ") || null,
  ].filter(Boolean);
  const details: [string, string | null][] = [
    ["TMDB rating", movie.vote_count ? `${movie.vote_average?.toFixed(1)} / 10 from ${movie.vote_count.toLocaleString("en-US")} votes` : null],
    ["Status", movie.status && movie.status !== "Released" ? movie.status : null],
    ["Original language", languageName(movie.original_language)],
    ["Budget", formatMoney(movie.budget)],
    ["Revenue", formatMoney(movie.revenue)],
  ];

  return (
    <article className="movie">
      {movie.backdrop_path && (
        <div className="backdrop" aria-hidden>
          <TmdbImage path={movie.backdrop_path} alt="" width={1280} aspect="backdrop" priority />
        </div>
      )}
      <div className="title-block">
        <TmdbImage path={movie.poster_path} alt={movie.title} width={300} aspect="poster" priority className="title-poster" />
        <div className="title-text">
          <h1>
            {movie.title} {movie.release_year && <span className="year">{movie.release_year}</span>}
          </h1>
          {movie.original_title && movie.original_title !== movie.title && (
            <p className="sub">Original title: {movie.original_title}</p>
          )}
          {facts.length > 0 && <p className="facts">{facts.join("  |  ")}</p>}
          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
          {movie.overview && <p className="overview">{movie.overview}</p>}
          {crew.length > 0 && (
            <dl className="key-crew">
              {crew.map(({ job, people }) => (
                <div key={job}>
                  <dt>{job}</dt>
                  <dd>
                    {people.map((p, i) => (
                      <span key={p.tmdb_id}>
                        {i > 0 && ", "}
                        <Link href={personPath(p.tmdb_id, p.name)}>{p.name}</Link>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="ext-links">
            {movie.imdb_id && (
              <a href={`https://www.imdb.com/title/${movie.imdb_id}/`} target="_blank" rel="noreferrer">
                IMDb
              </a>
            )}
            <a href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`} target="_blank" rel="noreferrer">
              TMDB
            </a>
          </p>
        </div>
      </div>

      {cast.length > 0 && (
        <>
          <h2>Cast</h2>
          <ul className="cast-grid">
            {cast.map((c) => (
              <li key={c.credit_id}>
                <Link href={personPath(c.person.tmdb_id, c.person.name)} className="cast-card">
                  <TmdbImage path={c.person.profile_path} alt={c.person.name} width={154} aspect="profile" />
                  <span className="cast-name">{c.person.name}</span>
                  {c.character && <span className="cast-character">{c.character}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {details.some(([, v]) => v) && (
        <>
          <h2>Details</h2>
          <dl className="details">
            {details
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </>
      )}
    </article>
  );
}
