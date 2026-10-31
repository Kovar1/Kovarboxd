import { describe, expect, it } from "vitest";
import { joinNames, MAX_PEOPLE, parsePersonIds, rolesByMovie, togetherPath, type RoleRow } from "@/lib/together";

describe("parsePersonIds", () => {
  it("reads a comma separated list", () => {
    expect(parsePersonIds("1032,380,4517")).toEqual([1032, 380, 4517]);
    expect(parsePersonIds(" 1032 , 380 ")).toEqual([1032, 380]);
  });

  it("drops junk, zero and repeats, keeping the first order", () => {
    expect(parsePersonIds("380,abc,,0,380,-5,1032")).toEqual([380, 1032]);
    expect(parsePersonIds(undefined)).toEqual([]);
  });

  it("accepts a repeated ?ids= parameter", () => {
    expect(parsePersonIds(["1032", "380,4517"])).toEqual([1032, 380, 4517]);
  });

  it(`stops at ${MAX_PEOPLE} people`, () => {
    expect(parsePersonIds("1,2,3,4,5,6,7,8")).toHaveLength(MAX_PEOPLE);
  });
});

describe("togetherPath", () => {
  it("builds the shareable URL", () => {
    expect(togetherPath([1032, 380])).toBe("/together?ids=1032,380");
    expect(togetherPath([])).toBe("/together");
  });
});

describe("rolesByMovie", () => {
  const rows: RoleRow[] = [
    { person_id: 1032, movie_id: 524, kind: "crew", character: null, job: "Director" },
    { person_id: 1032, movie_id: 524, kind: "crew", character: null, job: "Screenplay" },
    { person_id: 380, movie_id: 524, kind: "cast", character: "Sam 'Ace' Rothstein", job: null },
    { person_id: 1032, movie_id: 769, kind: "cast", character: "Narrator", job: null },
    { person_id: 1032, movie_id: 769, kind: "crew", character: null, job: "Director" },
    { person_id: 4517, movie_id: 769, kind: "cast", character: null, job: null },
    { person_id: 1032, movie_id: 524, kind: "crew", character: null, job: "Director" },
  ];
  const roles = rolesByMovie(rows);

  it("lists each person's roles per movie once", () => {
    expect(roles.get(524)?.get(1032)).toEqual(["Director", "Screenplay"]);
    expect(roles.get(524)?.get(380)).toEqual(["as Sam 'Ace' Rothstein"]);
  });

  it("puts acting first and labels a role-less cast credit", () => {
    expect(roles.get(769)?.get(1032)).toEqual(["as Narrator", "Director"]);
    expect(roles.get(769)?.get(4517)).toEqual(["Cast"]);
  });
});

describe("joinNames", () => {
  it("joins names like a sentence", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});
