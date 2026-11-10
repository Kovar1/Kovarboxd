import { seenLabel } from "@/lib/list-rules";
import { getMovieStatus, getSeenAmong, getSeenIds } from "@/lib/user-lists";
import { LabelRow } from "./Jumpsuit";
import { ListButtons } from "./ListButtons";
import { SeenHydrator } from "./SeenStore";

// Personal parts of cached pages. They read the session, so each page wraps
// them in <Suspense> and everything around them stays cached.

export async function MovieListControls({ movieId }: { movieId: number }) {
  return <ListButtons movieId={movieId} initial={await getMovieStatus(movieId)} />;
}

export async function PersonSeenRow({ movieIds }: { movieIds: number[] }) {
  return <LabelRow name="You've seen" value={seenLabel((await getSeenAmong(movieIds)).size, movieIds.length)} />;
}

/** Hands the person's seen films to every Seen stamp on the page. */
export async function SeenLoader() {
  return <SeenHydrator ids={await getSeenIds()} />;
}
