import Link from "next/link";
import { Burst, Slab } from "@/components/Jumpsuit";

export default function NotFound() {
  return (
    <section className="hero">
      <Slab>
        <h1 className="big cutT">Not in the catalog.</h1>
        <p>That movie or person isn&apos;t in Kovarboxd. It may be below the popularity cutoff, or gone from TMDB.</p>
        <div className="examples">
          <Link href="/">Back to the start</Link>
        </div>
      </Slab>
      <div className="hero-side">
        <Burst value="404" />
      </div>
    </section>
  );
}
