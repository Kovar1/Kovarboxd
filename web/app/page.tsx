import { MovieGrid } from "@/components/MovieGrid";
import { PeoplePicker } from "@/components/PeoplePicker";
import { TogetherExamples } from "@/components/Together";
import { getPopularMovies } from "@/lib/catalog";

export default async function HomePage() {
  const popular = await getPopularMovies(24);
  return (
    <>
      <section className="home-intro">
        <h1>Every film a group of people made together.</h1>
        <p className="sub">
          Pick two or more actors, directors, writers or composers. Kovarboxd finds every movie they all worked on,
          from 35,000 of TMDB&apos;s most popular.
        </p>
        <PeoplePicker selected={[]} />
        <TogetherExamples />
      </section>
      <h2>Popular now</h2>
      <MovieGrid movies={popular} priorityCount={6} />
    </>
  );
}
