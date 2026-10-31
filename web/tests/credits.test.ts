import { describe, expect, it } from "vitest";
import { castOf, crewByJob, filmography, knownFor } from "@/lib/credits";
import { ageBetween, formatDate, formatRuntime } from "@/lib/format";
import type { FilmCredit, MovieDetail } from "@/lib/types";

type MovieCredit = MovieDetail["credits"][number];

const person = (tmdb_id: number, name: string) => ({ tmdb_id, name, profile_path: null });
const cast = (id: string, order: number, who: ReturnType<typeof person>, character: string): MovieCredit => ({
  credit_id: id, kind: "cast", character, cast_order: order, department: null, job: null, person: who,
});
const crew = (id: string, job: string, who: ReturnType<typeof person>): MovieCredit => ({
  credit_id: id, kind: "crew", character: null, cast_order: null, department: "Dept", job, person: who,
});

const scorsese = person(1032, "Martin Scorsese");
const deNiro = person(380, "Robert De Niro");
const pesci = person(4517, "Joe Pesci");
const pileggi = person(1, "Nicholas Pileggi");

describe("movie credits", () => {
  const credits = [
    crew("c1", "Producer", person(2, "Irwin Winkler")),
    cast("a2", 1, pesci, "Tommy DeVito"),
    crew("c2", "Screenplay", pileggi),
    crew("c3", "Director", scorsese),
    cast("a1", 0, deNiro, "James Conway"),
    crew("c4", "Screenplay", scorsese),
    crew("c5", "Novel", pileggi),
    crew("c6", "Screenplay", scorsese), // a duplicate credit should list him once
  ];

  it("orders cast by billing", () => {
    expect(castOf(credits).map((c) => c.person.name)).toEqual(["Robert De Niro", "Joe Pesci"]);
  });

  it("groups crew by job in the page order, each person once", () => {
    expect(crewByJob(credits).map(({ job, people }) => [job, people.map((p) => p.name)])).toEqual([
      ["Director", ["Martin Scorsese"]],
      ["Screenplay", ["Nicholas Pileggi", "Martin Scorsese"]],
      ["Novel", ["Nicholas Pileggi"]],
      ["Producer", ["Irwin Winkler"]],
    ]);
  });
});

describe("person filmography", () => {
  const movie = (tmdb_id: number, title: string, release_date: string | null, popularity: number) => ({
    tmdb_id, title, release_date, release_year: release_date ? Number(release_date.slice(0, 4)) : null,
    poster_path: null, popularity,
  });
  const goodfellas = movie(769, "GoodFellas", "1990-09-12", 20);
  const casino = movie(524, "Casino", "1995-11-22", 12);
  const upcoming = movie(9, "Untitled Project", null, 3);
  const credit = (id: string, kind: "cast" | "crew", m: FilmCredit["movie"], role: string): FilmCredit => ({
    credit_id: id, kind, movie: m, character: kind === "cast" ? role : null, cast_order: kind === "cast" ? 0 : null,
    department: kind === "crew" ? "Dept" : null, job: kind === "crew" ? role : null,
  });
  const credits = [
    credit("1", "crew", goodfellas, "Director"),
    credit("2", "crew", goodfellas, "Screenplay"),
    credit("3", "crew", casino, "Director"),
    credit("4", "cast", goodfellas, "Narrator"),
    credit("5", "crew", upcoming, "Producer"),
  ];

  it("merges roles per movie, newest first, unreleased at the top", () => {
    const { acting, crew: crewRows } = filmography(credits);
    expect(crewRows.map((r) => [r.movie.title, r.roles])).toEqual([
      ["Untitled Project", ["Producer"]],
      ["Casino", ["Director"]],
      ["GoodFellas", ["Director", "Screenplay"]],
    ]);
    expect(acting.map((r) => [r.movie.title, r.roles])).toEqual([["GoodFellas", ["Narrator"]]]);
  });

  it("known for lists distinct movies by popularity", () => {
    expect(knownFor(credits, 2).map((m) => m.title)).toEqual(["GoodFellas", "Casino"]);
  });
});

describe("format", () => {
  it("formats dates in UTC so they never shift a day", () => {
    expect(formatDate("1942-11-17")).toBe("November 17, 1942");
    expect(formatDate(null)).toBeNull();
  });

  it("formats runtimes", () => {
    expect(formatRuntime(146)).toBe("2h 26m");
    expect(formatRuntime(45)).toBe("45m");
    expect(formatRuntime(null)).toBeNull();
  });

  it("computes age, counting the birthday itself", () => {
    expect(ageBetween("1942-11-17", "2026-11-16")).toBe(83);
    expect(ageBetween("1942-11-17", "2026-11-17")).toBe(84);
  });
});
