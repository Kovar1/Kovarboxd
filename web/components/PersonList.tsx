import Link from "next/link";
import { personPath } from "@/lib/slug";
import type { PersonSummary } from "@/lib/types";
import { TmdbImage } from "./TmdbImage";

export function PersonList({ people }: { people: PersonSummary[] }) {
  return (
    <ul className="person-list">
      {people.map((p) => (
        <li key={p.tmdb_id}>
          <Link href={personPath(p.tmdb_id, p.name)} className="person-row">
            <TmdbImage path={p.profile_path} alt={p.name} width={56} aspect="profile" />
            <span>
              <span className="person-row-name">{p.name}</span>
              {p.known_for_department && <span className="person-row-dept">{p.known_for_department}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
