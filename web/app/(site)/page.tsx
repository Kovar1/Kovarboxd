import { BoxLabel, Burst, SectionHead, Slab } from "@/components/Jumpsuit";
import { MovieGrid } from "@/components/MovieGrid";
import { PeoplePicker } from "@/components/PeoplePicker";
import { TogetherExamples } from "@/components/Together";
import { getPopularMovies } from "@/lib/catalog";

export default async function HomePage() {
  const popular = await getPopularMovies(24);
  return (
    <div className="home">
      <section className="hero">
        <Slab>
          <h1 className="big m cutT">Every film a group of people made together.</h1>
          <p>Pick two or more actors, directors, writers or composers.</p>
          <PeoplePicker selected={[]} />
          <TogetherExamples />
        </Slab>
        <div className="hero-side">
          <Burst value="35K" />
          {/* Rounded on purpose: the catalog only grows by a few films a night. */}
          <BoxLabel
            rows={[
              ["Films", "35,000"],
              ["People", "330,000"],
              ["Credits", "790,000"],
            ]}
          />
        </div>
      </section>
      <SectionHead title="Popular now" />
      <MovieGrid movies={popular} priorityCount={6} />
    </div>
  );
}
