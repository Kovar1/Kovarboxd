import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MovieGrid } from "@/components/MovieGrid";
import { getListCounts, getMyList } from "@/lib/user-lists";

export const metadata: Metadata = { title: "My lists" };

type Props = { searchParams: Promise<{ list?: string }> };

export default function MyListsPage({ searchParams }: Props) {
  return (
    <section>
      <h1>My lists</h1>
      <Suspense fallback={<p className="empty">Loading...</p>}>
        <MyLists searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function MyLists({ searchParams }: Props) {
  const list = (await searchParams).list === "watchlist" ? "watchlist" : "seen";
  const [counts, movies] = await Promise.all([getListCounts(), getMyList(list)]);

  return (
    <>
      <nav className="list-tabs" aria-label="My lists">
        <Link href="/me" className={list === "seen" ? "active" : ""}>
          Seen <span className="count">{counts.seen}</span>
        </Link>
        <Link href="/me?list=watchlist" className={list === "watchlist" ? "active" : ""}>
          Watchlist <span className="count">{counts.watchlist}</span>
        </Link>
      </nav>
      {movies.length > 0 ? (
        <MovieGrid movies={movies} />
      ) : (
        <p className="empty">
          {list === "seen"
            ? "Nothing yet. Open any movie and click Mark seen."
            : "Nothing yet. Open any movie and click + Watchlist."}
        </p>
      )}
    </>
  );
}
