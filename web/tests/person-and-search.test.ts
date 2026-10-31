import { describe, expect, it } from "vitest";
import { lifeFacts } from "@/lib/format";
import { detailsAreStale } from "@/lib/person-details";
import { strongNameMatch } from "@/lib/search";

describe("strongNameMatch", () => {
  it("matches when every typed word starts a word of the name", () => {
    expect(strongNameMatch("tom han", "Tom Hanks")).toBe(true);
    expect(strongNameMatch("scorsese", "Martin Scorsese")).toBe(true);
    expect(strongNameMatch("amelie", "Amélie Poulain")).toBe(true);
  });

  it("doesn't match typos or partial overlaps", () => {
    expect(strongNameMatch("godfahter", "Peter Godfrey")).toBe(false);
    expect(strongNameMatch("tom cruise", "Tom Hanks")).toBe(false);
    expect(strongNameMatch("   ", "Tom Hanks")).toBe(false);
  });
});

describe("detailsAreStale", () => {
  const now = Date.parse("2026-10-31T12:00:00Z");

  it("is stale when never fetched or older than 30 days", () => {
    expect(detailsAreStale(null, now)).toBe(true);
    expect(detailsAreStale("2026-09-30T11:00:00Z", now)).toBe(true);
  });

  it("is fresh within 30 days", () => {
    expect(detailsAreStale("2026-10-02T12:00:00Z", now)).toBe(false);
  });
});

describe("lifeFacts", () => {
  it("gives age for the living", () => {
    expect(lifeFacts({ birthday: "1943-02-09", deathday: null, place_of_birth: "Newark, New Jersey, USA" }, "2026-10-31"))
      .toEqual(["Born February 9, 1943 in Newark, New Jersey, USA (age 83)"]);
  });

  it("gives age at death for the dead", () => {
    expect(lifeFacts({ birthday: "1928-07-26", deathday: "1999-03-07", place_of_birth: null }, "2026-10-31"))
      .toEqual(["Born July 26, 1928", "Died March 7, 1999 (aged 70)"]);
  });

  it("copes with missing dates", () => {
    expect(lifeFacts({ birthday: null, deathday: null, place_of_birth: "Rome" }, "2026-10-31")).toEqual(["Born in Rome"]);
    expect(lifeFacts({ birthday: null, deathday: null, place_of_birth: null }, "2026-10-31")).toEqual([]);
  });
});
