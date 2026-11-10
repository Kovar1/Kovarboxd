import Link from "next/link";
import { moviePath } from "@/lib/slug";
import type { MovieSummary } from "@/lib/types";
import { CutImage } from "./CutImage";
import { SeenStamp } from "./SeenStore";

export function MovieGrid({ movies, priorityCount = 0 }: { movies: MovieSummary[]; priorityCount?: number }) {
  return (
    <ul className="grid">
      {movies.map((m, i) => (
        <li key={m.tmdb_id}>
          <Link href={moviePath(m.tmdb_id, m.title)} className="pc">
            <SeenStamp id={m.tmdb_id} />
            <CutImage id={m.tmdb_id} path={m.poster_path} alt={m.title} width={185} priority={i < priorityCount} />
            <span className="t">{m.title}</span>
            {m.release_year && <span className="y2">{m.release_year}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
