"use client";

import Link from "next/link";
import { useState } from "react";
import { groupByDecade, type FilmographyRow } from "@/lib/credits";
import { moviePath } from "@/lib/slug";
import { SectionHead } from "./Jumpsuit";
import { SeenTag } from "./SeenStore";

const SHORT_LIST = 14;

/** A filmography by decade, newest first. Long ones start collapsed. */
export function Filmography({ title, rows, rolePrefix = "" }: { title: string; rows: FilmographyRow[]; rolePrefix?: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const long = rows.length > SHORT_LIST;
  const shown = long && !all ? rows.slice(0, SHORT_LIST) : rows;
  return (
    <>
      <SectionHead title={title} note={`${rows.length} ${rows.length === 1 ? "film" : "films"}`} />
      {groupByDecade(shown).map(({ decade, rows: group }) => (
        <section key={decade} className="fd">
          <h3>{decade}</h3>
          <ol>
            {group.map(({ movie, roles }) => (
              <li key={movie.tmdb_id}>
                <Link href={moviePath(movie.tmdb_id, movie.title)} className="fr">
                  <b>{movie.release_year ?? "TBA"}</b>
                  <strong>
                    {movie.title}
                    <SeenTag id={movie.tmdb_id} />
                  </strong>
                  <span>{roles.length > 0 && rolePrefix + roles.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {long && (
        <button type="button" className="btn line more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
