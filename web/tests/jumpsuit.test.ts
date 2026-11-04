import { describe, expect, it } from "vitest";
import { groupByDecade, type FilmographyRow } from "@/lib/credits";
import { cutOutline } from "@/lib/cut";

describe("cutOutline", () => {
  it("gives a film the same outline every time", () => {
    expect(cutOutline(769)).toBe(cutOutline(769));
  });

  it("gives different films different outlines", () => {
    expect(cutOutline(769)).not.toBe(cutOutline(770));
  });

  it("stays inside the image", () => {
    for (const seed of [0, 1, 769, 398978, 2147483647]) {
      const numbers = [...cutOutline(seed).matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
      expect(numbers.length).toBeGreaterThan(0);
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }
    }
  });

  it("only wobbles by the amount asked for", () => {
    const edge = cutOutline(769, 1).match(/^polygon\(0\.0% ([\d.]+)%/);
    expect(Number(edge?.[1])).toBeLessThanOrEqual(1);
  });
});

describe("groupByDecade", () => {
  const row = (title: string, release_year: number | null) => ({ movie: { title, release_year }, roles: [] }) as unknown as FilmographyRow;

  it("groups in the order given, with no date as TBA", () => {
    const groups = groupByDecade([row("Soon", null), row("B", 2019), row("A", 2010), row("C", 1999)]);
    expect(groups.map((g) => [g.decade, g.rows.map((r) => r.movie.title)])).toEqual([
      ["TBA", ["Soon"]],
      ["2010s", ["B", "A"]],
      ["1990s", ["C"]],
    ]);
  });

  it("handles an empty list", () => {
    expect(groupByDecade([])).toEqual([]);
  });
});
