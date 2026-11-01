"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="message-page">
      <h1>Something went wrong</h1>
      <p className="sub">The catalog didn&apos;t answer. Try again in a moment.</p>
      <p>
        <button className="button" onClick={() => reset()}>
          Try again
        </button>
      </p>
    </section>
  );
}
