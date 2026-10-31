// Live check of what the public anon key can and can't do in the kovarboxd
// schema. Runs against the Supabase project in .env.local and skips itself
// when those values are missing (for example in CI).
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the suite skips below.
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

describe.skipIf(!url || !anonKey)("anon access to kovarboxd", () => {
  const db = () =>
    createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } }).schema("kovarboxd");

  it("can read catalog movies with credits and people", async () => {
    const { data, error } = await db()
      .from("movies")
      .select("title, credits ( kind, people ( name ) )")
      .eq("tmdb_id", 769)
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe("GoodFellas");
    expect(data?.credits.length).toBeGreaterThan(10);
  });

  it("can search", async () => {
    const { data, error } = await db().rpc("search_people", { q: "kubrik", max_results: 3 });
    expect(error).toBeNull();
    expect(data?.[0]?.name).toBe("Stanley Kubrick");
  });

  it("can find films people made together", async () => {
    const { data, error } = await db()
      .rpc("films_together", { person_ids: [1032, 380, 4517] })
      .select("title");
    expect(error).toBeNull();
    const titles = (data as unknown as { title: string }[]).map((m) => m.title);
    expect(titles).toEqual(expect.arrayContaining(["GoodFellas", "Casino", "Raging Bull", "The Irishman"]));
  });

  it("can't read pipeline runs or migrations", async () => {
    for (const table of ["pipeline_runs", "schema_migrations"]) {
      const { data, error } = await db().from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    }
  });

  it("can't write to the catalog", async () => {
    const { error: insert } = await db().from("genres").insert({ id: 999999, name: "Test" });
    expect(insert?.code).toBe("42501");
    const { error: update } = await db().from("movies").update({ title: "Changed" }).eq("tmdb_id", 769);
    expect(update?.code).toBe("42501");
  });

  it("can't save person details", async () => {
    const { error } = await db().rpc("save_person_details", {
      person_id: 1032,
      new_biography: "vandalized",
      new_birthday: null,
      new_deathday: null,
      new_place_of_birth: null,
    });
    expect(error?.code).toBe("42501");
  });
});
