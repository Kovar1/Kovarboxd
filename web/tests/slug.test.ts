import { describe, expect, it } from "vitest";
import { moviePath, parseIdParam, personPath, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("The Godfather Part II")).toBe("the-godfather-part-ii");
  });

  it("drops accents and punctuation", () => {
    expect(slugify("Amélie: Le Fabuleux Destin!")).toBe("amelie-le-fabuleux-destin");
    expect(slugify("Schindler's List")).toBe("schindler-s-list");
  });

  it("returns an empty slug for titles with no Latin letters", () => {
    expect(slugify("千と千尋の神隠し")).toBe("");
  });

  it("caps long slugs without a trailing dash", () => {
    const slug = slugify("word ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("paths", () => {
  it("puts the id first", () => {
    expect(moviePath(769, "GoodFellas")).toBe("/movie/769-goodfellas");
    expect(personPath(1032, "Martin Scorsese")).toBe("/person/1032-martin-scorsese");
  });

  it("leaves the slug off when there is nothing to slug", () => {
    expect(moviePath(129, "千と千尋の神隠し")).toBe("/movie/129");
  });
});

describe("parseIdParam", () => {
  it("reads the id with or without a slug", () => {
    expect(parseIdParam("769-goodfellas")).toBe(769);
    expect(parseIdParam("769")).toBe(769);
    expect(parseIdParam("769-anything-at-all")).toBe(769);
  });

  it("rejects anything that doesn't start with an id", () => {
    expect(parseIdParam("goodfellas")).toBeNull();
    expect(parseIdParam("769goodfellas")).toBeNull();
    expect(parseIdParam("")).toBeNull();
    expect(parseIdParam("12345678901")).toBeNull();
  });
});
