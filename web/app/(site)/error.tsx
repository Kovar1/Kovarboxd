"use client";

import { Burst, Slab } from "@/components/Jumpsuit";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="hero">
      <Slab>
        <h1 className="big m cutT">Something went wrong</h1>
        <p>The catalog didn&apos;t answer. Try again in a moment.</p>
        <button className="btn" onClick={() => reset()}>
          Try again
        </button>
      </Slab>
      <div className="hero-side">
        <Burst value="!" />
      </div>
    </section>
  );
}
