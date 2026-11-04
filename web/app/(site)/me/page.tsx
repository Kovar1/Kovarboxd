import type { Metadata } from "next";
import { Suspense } from "react";
import { ListTabs } from "@/components/ListTabs";
import { MovieGrid } from "@/components/MovieGrid";
import { getMyList } from "@/lib/user-lists";

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
  const movies = await getMyList(list);

  return (
    <>
      <ListTabs active={list} />
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
