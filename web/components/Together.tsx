import Link from "next/link";
import { getPeople } from "@/lib/catalog";
import { moviePath, personPath } from "@/lib/slug";
import { togetherPath } from "@/lib/together";
import type { PersonSummary, TogetherFilm } from "@/lib/types";
import { CutImage } from "./CutImage";
import { SeenToggle } from "./ListButtons";
import { SeenStamp } from "./SeenStore";

/** Shared films, newest first, with what each person did on each one and whether you've seen it. */
export function TogetherResults({
  films,
  people,
  seen,
}: {
  films: TogetherFilm[];
  people: PersonSummary[];
  seen: Set<number>;
}) {
  const byId = new Map(people.map((p) => [p.tmdb_id, p]));
  return (
    <ol className="grid l">
      {films.map((f) => (
        <li key={f.tmdb_id} className="card">
          <SeenStamp id={f.tmdb_id} />
          <Link href={moviePath(f.tmdb_id, f.title)} className="pc">
            <CutImage id={f.tmdb_id} path={f.poster_path} alt={f.title} width={342} />
            <span className="t">{f.title}</span>
          </Link>
          <span className="y2">{f.release_year ?? "TBA"}</span>
          {f.roles.map(({ person_id, roles }) => {
            const person = byId.get(person_id);
            if (!person) return null;
            // "Robert De Niro as Sam Rothstein", "Martin Scorsese Director, Screenplay"
            return (
              <p key={person_id} className="cr">
                <Link href={personPath(person.tmdb_id, person.name)}>{person.name}</Link> {roles.join(", ")}
              </p>
            );
          })}
          <SeenToggle movieId={f.tmdb_id} initial={seen.has(f.tmdb_id)} />
        </li>
      ))}
    </ol>
  );
}

// Known pairings, all with several shared films in the catalog.
const EXAMPLES = [
  [1032, 380, 4517], // Martin Scorsese, Robert De Niro, Joe Pesci
  [5655, 1532], // Wes Anderson, Bill Murray
  [525, 3895], // Christopher Nolan, Michael Caine
  [510, 85], // Tim Burton, Johnny Depp
  [138, 2231], // Quentin Tarantino, Samuel L. Jackson
  [488, 31], // Steven Spielberg, Tom Hanks
];

/** One-click example searches. */
export async function TogetherExamples() {
  const people = await getPeople([...new Set(EXAMPLES.flat())]);
  const names = new Map(people.map((p) => [p.tmdb_id, p.name]));
  return (
    <div className="examples">
      {EXAMPLES.map((ids) => (
        <Link key={ids.join(",")} href={togetherPath(ids)}>
          {ids
            .map((id) => names.get(id))
            .filter(Boolean)
            .join(" + ")}
        </Link>
      ))}
    </div>
  );
}
