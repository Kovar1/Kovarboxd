"use server";

import { refresh } from "next/cache";
import { createAuthClient } from "@/lib/auth-client";
import { isValidMovieId, parseSeenDate } from "@/lib/list-rules";

// Changes to the logged-in person's lists. Each action checks the login itself
// instead of relying on proxy.ts, and the database's rules then limit the
// write to that person's own rows.

export type ListResult = { error?: string };

const FAILED = "That didn't save. Try again.";

async function me() {
  const client = await createAuthClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { db: client.schema("kovarboxd"), userId: user.id } : null;
}

/** Marks a movie seen or not. Marking it seen also takes it off the watchlist. */
export async function setSeen(movieId: number, seen: boolean): Promise<ListResult> {
  if (!isValidMovieId(movieId)) return { error: FAILED };
  const session = await me();
  if (!session) return { error: "Please log in again." };
  const { db, userId } = session;

  const write = seen
    ? await db
        .from("seen")
        // ignoreDuplicates keeps the date if it was already marked seen.
        .upsert({ user_id: userId, movie_id: movieId }, { onConflict: "user_id,movie_id", ignoreDuplicates: true })
    : await db.from("seen").delete().eq("user_id", userId).eq("movie_id", movieId);
  if (write.error) return { error: FAILED };

  if (seen) {
    const { error } = await db.from("watchlist").delete().eq("user_id", userId).eq("movie_id", movieId);
    if (error) return { error: FAILED };
  }
  refresh();
  return {};
}

/** Sets or clears the optional date on a movie already marked seen. */
export async function setSeenDate(movieId: number, date: string): Promise<ListResult> {
  if (!isValidMovieId(movieId)) return { error: FAILED };
  const seenOn = parseSeenDate(date);
  if (date !== "" && !seenOn) return { error: "That isn't a valid date." };
  const session = await me();
  if (!session) return { error: "Please log in again." };

  const { error } = await session.db
    .from("seen")
    .update({ seen_on: seenOn })
    .eq("user_id", session.userId)
    .eq("movie_id", movieId);
  if (error) return { error: FAILED };
  refresh();
  return {};
}

export async function setWatchlist(movieId: number, on: boolean): Promise<ListResult> {
  if (!isValidMovieId(movieId)) return { error: FAILED };
  const session = await me();
  if (!session) return { error: "Please log in again." };
  const { db, userId } = session;

  const { error } = on
    ? await db
        .from("watchlist")
        .upsert({ user_id: userId, movie_id: movieId }, { onConflict: "user_id,movie_id", ignoreDuplicates: true })
    : await db.from("watchlist").delete().eq("user_id", userId).eq("movie_id", movieId);
  if (error) return { error: FAILED };
  refresh();
  return {};
}
