import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chunks, isValidMovieId, parseSeenDate, seenLabel } from "@/lib/list-rules";
import { togetherPath } from "@/lib/together";

// A stand-in for the logged-in Supabase client. It records every write, so the
// tests can check what each action does without a real login.
type Call = { table: string; op: string; row?: unknown; filters: Record<string, unknown> };
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  calls: [] as Call[],
  writeError: null as { message: string } | null,
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  createAuthClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    schema: () => ({
      from: (table: string) => {
        const call = (op: string, row?: unknown) => {
          const entry: Call = { table, op, row, filters: {} };
          state.calls.push(entry);
          const chain = {
            eq(column: string, value: unknown) {
              entry.filters[column] = value;
              return chain;
            },
            then(resolve: (value: { error: typeof state.writeError }) => void) {
              resolve({ error: state.writeError });
            },
          };
          return chain;
        };
        return {
          upsert: (row: unknown) => call("upsert", row),
          update: (row: unknown) => call("update", row),
          delete: () => call("delete"),
        };
      },
    }),
  }),
}));

import { ListButtons, SeenToggle } from "@/components/ListButtons";
import { setSeen, setSeenDate, setWatchlist } from "@/lib/list-actions";

beforeEach(() => {
  state.user = { id: "me" };
  state.calls = [];
  state.writeError = null;
});

describe("list actions", () => {
  it("refuses when logged out, and writes nothing", async () => {
    state.user = null;
    expect((await setSeen(769, true)).error).toMatch(/log in/i);
    expect((await setWatchlist(769, true)).error).toMatch(/log in/i);
    expect((await setSeenDate(769, "2026-01-01")).error).toMatch(/log in/i);
    expect(state.calls).toEqual([]);
  });

  it("marking seen saves it for this user and takes it off the watchlist", async () => {
    expect(await setSeen(769, true)).toEqual({});
    expect(state.calls.map((c) => [c.table, c.op])).toEqual([
      ["seen", "upsert"],
      ["watchlist", "delete"],
    ]);
    expect(state.calls[0].row).toEqual({ user_id: "me", movie_id: 769 });
    expect(state.calls[1].filters).toEqual({ user_id: "me", movie_id: 769 });
  });

  it("unmarking seen deletes only that row and leaves the watchlist alone", async () => {
    await setSeen(769, false);
    expect(state.calls).toEqual([
      { table: "seen", op: "delete", row: undefined, filters: { user_id: "me", movie_id: 769 } },
    ]);
  });

  it("toggles the watchlist", async () => {
    await setWatchlist(769, true);
    await setWatchlist(769, false);
    expect(state.calls.map((c) => [c.table, c.op])).toEqual([
      ["watchlist", "upsert"],
      ["watchlist", "delete"],
    ]);
  });

  it("sets and clears the date, and rejects a fake one", async () => {
    await setSeenDate(769, "2026-10-31");
    await setSeenDate(769, "");
    expect(state.calls.map((c) => c.row)).toEqual([{ seen_on: "2026-10-31" }, { seen_on: null }]);
    expect((await setSeenDate(769, "2026-02-31")).error).toMatch(/valid date/);
    expect(state.calls).toHaveLength(2);
  });

  it("rejects bad movie ids before touching the database", async () => {
    expect((await setSeen(-1, true)).error).toBeTruthy();
    expect((await setWatchlist(1.5, true)).error).toBeTruthy();
    expect(state.calls).toEqual([]);
  });

  it("reports a failed write instead of pretending it worked", async () => {
    state.writeError = { message: "nope" };
    expect((await setSeen(769, true)).error).toBeTruthy();
  });
});

describe("list buttons render", () => {
  it("offers both actions when the movie is on no list", () => {
    const html = renderToString(<ListButtons movieId={769} initial={{ seen: false, seenOn: null, watchlist: false }} />);
    expect(html).toContain("Mark seen");
    expect(html).toContain("+ Watchlist");
    expect(html).not.toContain('type="date"');
  });

  it("shows the state and date field when seen", () => {
    const html = renderToString(
      <ListButtons movieId={769} initial={{ seen: true, seenOn: "2026-10-31", watchlist: false }} />,
    );
    expect(html).toContain("Seen");
    expect(html).toContain('value="2026-10-31"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("the small toggle reflects its state", () => {
    expect(renderToString(<SeenToggle movieId={769} initial={true} />)).toContain('aria-pressed="true"');
    expect(renderToString(<SeenToggle movieId={769} initial={false} />)).toContain("Mark seen");
  });
});

describe("list rules", () => {
  it("accepts only real calendar dates", () => {
    expect(parseSeenDate("2026-10-31")).toBe("2026-10-31");
    expect(parseSeenDate("2026-02-31")).toBeNull();
    expect(parseSeenDate("yesterday")).toBeNull();
    expect(parseSeenDate("")).toBeNull();
    expect(parseSeenDate(undefined)).toBeNull();
  });

  it("validates movie ids", () => {
    expect(isValidMovieId(769)).toBe(true);
    expect(isValidMovieId(0)).toBe(false);
    expect(isValidMovieId("769")).toBe(false);
  });

  it("summarizes what you've seen", () => {
    expect(seenLabel(2, 4)).toBe("2 of 4");
    expect(seenLabel(4, 4)).toBe("All 4");
    expect(seenLabel(1, 1)).toBe("1 of 1");
    expect(seenLabel(0, 4)).toBe("0 of 4");
  });

  it("splits long id lists", () => {
    expect(chunks([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it("keeps the hide-seen setting in together links", () => {
    expect(togetherPath([1, 2], true)).toBe("/together?ids=1,2&unseen=1");
    expect(togetherPath([1, 2])).toBe("/together?ids=1,2");
  });
});
