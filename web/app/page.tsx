import { MovieGrid } from "@/components/MovieGrid";
import { getPopularMovies } from "@/lib/catalog";

export default async function HomePage() {
  const popular = await getPopularMovies(24);
  return (
    <>
      <section className="home-intro">
        <h1>Find a movie, or the people behind it.</h1>
        <p className="sub">35,000 of TMDB&apos;s most popular movies, with their cast and key crew.</p>
      </section>
      <h2>Popular now</h2>
      <MovieGrid movies={popular} priorityCount={6} />
    </>
  );
}
