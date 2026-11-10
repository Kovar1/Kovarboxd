import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CutImage } from "@/components/CutImage";
import { bigSize, BoxLabel, Burst, SectionHead, Slab } from "@/components/Jumpsuit";
import { MovieListControls } from "@/components/MyListBits";
import { TmdbImage } from "@/components/TmdbImage";
import { getMovie, getPopularMovies } from "@/lib/catalog";
import { castOf, crewByJob } from "@/lib/credits";
import { cutOutline } from "@/lib/cut";
import { formatDate, formatMoney, formatRuntime, languageName } from "@/lib/format";
import { moviePath, parseIdParam, personPath } from "@/lib/slug";

type Props = { params: Promise<{ id: string }> };

// Build the most popular movies ahead of time. Every other movie renders on
// its first visit and is cached after that.
export async function generateStaticParams() {
  try {
    const movies = await getPopularMovies(20);
    return movies.map((m) => ({ id: moviePath(m.tmdb_id, m.title).slice("/movie/".length) }));
  } catch (error) {
    // A slow database shouldn't fail the deploy: these pages build on first visit anyway.
    console.warn("Prebuilding movie pages skipped:", error);
    return [{ id: "769-goodfellas" }];
  }
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
  const genres = movie.genres.map((g) => g.name).join(", ") || null;
  const runtime = formatRuntime(movie.runtime);
  const meta = [movie.release_year, runtime, genres].filter(Boolean);
  const facts: [string, ReactNode][] = [
    ["Released", formatDate(movie.release_date)],
    ["Runtime", runtime],
    ["Genres", genres],
    ["TMDB votes", movie.vote_count ? movie.vote_count.toLocaleString("en-US") : null],
    ["Status", movie.status && movie.status !== "Released" ? movie.status : null],
    ["Language", languageName(movie.original_language)],
    ["Budget", formatMoney(movie.budget)],
    ["Revenue", formatMoney(movie.revenue)],
  ];

  return (
    <article>
      {movie.backdrop_path ? (
        <div className="bd" style={{ clipPath: cutOutline(movie.tmdb_id + 7, 1.1) }} aria-hidden>
          <TmdbImage path={movie.backdrop_path} alt="" width={1280} aspect="backdrop" priority />
        </div>
      ) : (
        <div className="no-bd" />
      )}
      <div className="ovl">
        <Slab>
          <h1 className={bigSize(movie.title)}>{movie.title}</h1>
          {meta.length > 0 && <p className="meta">{meta.join(" / ")}</p>}
          {movie.original_title && movie.original_title !== movie.title && <p>Original title: {movie.original_title}</p>}
        </Slab>
      </div>

      <div className="mg">
        <div className="pcol">
          <CutImage id={movie.tmdb_id} path={movie.poster_path} alt={movie.title} width={342} priority full />
          {/* Personal, so it streams in. The rest of this page stays cached. */}
          <Suspense fallback={<div className="list-buttons" />}>
            <MovieListControls movieId={movie.tmdb_id} />
          </Suspense>
          <p className="ext">
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

        <div>
          {movie.tagline && <p className="tag">{movie.tagline}</p>}
          {movie.overview && <p className="body">{movie.overview}</p>}
          {crew.length > 0 && (
            <dl className="crew">
              {crew.map(({ job, people }) => (
                <div key={job} style={{ display: "contents" }}>
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
        </div>

        <div className="side">
          {movie.vote_count ? <Burst value={movie.vote_average?.toFixed(1) ?? ""} /> : null}
          <BoxLabel rows={facts} />
        </div>
      </div>

      {cast.length > 0 && (
        <>
          <SectionHead title="Cast" />
          <ul className="cast">
            {cast.map((c) => (
              <li key={c.credit_id}>
                <Link href={personPath(c.person.tmdb_id, c.person.name)} className="pc">
                  <CutImage id={c.person.tmdb_id} path={c.person.profile_path} alt={c.person.name} width={154} aspect="profile" />
                  <b>{c.person.name}</b>
                  {c.character && <span className="ch">{c.character}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
