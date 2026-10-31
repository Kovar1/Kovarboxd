import Link from "next/link";
import { moviePath } from "@/lib/slug";
import type { MovieSummary } from "@/lib/types";
import { TmdbImage } from "./TmdbImage";

export function MovieGrid({ movies, priorityCount = 0 }: { movies: MovieSummary[]; priorityCount?: number }) {
  return (
    <ul className="movie-grid">
      {movies.map((m, i) => (
        <li key={m.tmdb_id}>
          <Link href={moviePath(m.tmdb_id, m.title)} className="movie-card">
            <TmdbImage path={m.poster_path} alt={m.title} width={185} aspect="poster" priority={i < priorityCount} />
            <span className="movie-card-title">{m.title}</span>
            {m.release_year && <span className="movie-card-year">{m.release_year}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
