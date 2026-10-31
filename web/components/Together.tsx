import Link from "next/link";
import { getPeople } from "@/lib/catalog";
import { moviePath, personPath } from "@/lib/slug";
import { togetherPath } from "@/lib/together";
import type { PersonSummary, TogetherFilm } from "@/lib/types";
import { TmdbImage } from "./TmdbImage";

/** Shared films, newest first, with what each person did on each one. */
export function TogetherResults({ films, people }: { films: TogetherFilm[]; people: PersonSummary[] }) {
  const byId = new Map(people.map((p) => [p.tmdb_id, p]));
  return (
    <ol className="together-list">
      {films.map((f) => (
        <li key={f.tmdb_id}>
          <Link href={moviePath(f.tmdb_id, f.title)} className="together-poster" tabIndex={-1} aria-hidden>
            <TmdbImage path={f.poster_path} alt={f.title} width={92} aspect="poster" />
          </Link>
          <div>
            <Link href={moviePath(f.tmdb_id, f.title)} className="together-title">
              {f.title}
            </Link>{" "}
            <span className="year">{f.release_year ?? "TBA"}</span>
            <ul className="together-roles">
              {f.roles.map(({ person_id, roles }) => {
                const person = byId.get(person_id);
                if (!person) return null;
                // "Robert De Niro as Sam Rothstein", "Martin Scorsese: Director, Screenplay"
                const separator = roles[0]?.startsWith("as ") ? " " : ": ";
                return (
                  <li key={person_id}>
                    <Link href={personPath(person.tmdb_id, person.name)} className="role-person">
                      {person.name}
                    </Link>
                    {roles.length > 0 && separator + roles.join(", ")}
                  </li>
                );
              })}
            </ul>
          </div>
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
      <span className="examples-label">Try</span>
      {EXAMPLES.map((ids) => (
        <Link key={ids.join(",")} href={togetherPath(ids)} className="example">
          {ids
            .map((id) => names.get(id))
            .filter(Boolean)
            .join(" + ")}
        </Link>
      ))}
    </div>
  );
}
