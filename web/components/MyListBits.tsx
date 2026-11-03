import { seenSummary } from "@/lib/list-rules";
import { getMovieStatus, getSeenAmong } from "@/lib/user-lists";
import { ListButtons } from "./ListButtons";

// Personal parts of cached pages. They read the session, so each page wraps
// them in <Suspense> and everything around them stays cached.

export async function MovieListControls({ movieId }: { movieId: number }) {
  return <ListButtons movieId={movieId} initial={await getMovieStatus(movieId)} />;
}

export async function PersonSeenCount({ movieIds }: { movieIds: number[] }) {
  const summary = seenSummary((await getSeenAmong(movieIds)).size, movieIds.length);
  return summary ? <p className="facts seen-summary">{summary} of their films here</p> : null;
}
