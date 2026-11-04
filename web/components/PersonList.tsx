import Link from "next/link";
import { personPath } from "@/lib/slug";
import type { PersonSummary } from "@/lib/types";
import { CutImage } from "./CutImage";

export function PersonList({ people }: { people: PersonSummary[] }) {
  return (
    <ul className="plist">
      {people.map((p) => (
        <li key={p.tmdb_id}>
          <Link href={personPath(p.tmdb_id, p.name)} className="pr">
            <CutImage id={p.tmdb_id} path={p.profile_path} alt={p.name} width={56} aspect="profile" />
            <span>
              <strong>{p.name}</strong>
              {p.known_for_department && <span>{p.known_for_department}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
