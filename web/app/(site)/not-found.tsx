import Link from "next/link";

export default function NotFound() {
  return (
    <section className="message-page">
      <h1>Not found</h1>
      <p className="sub">
        That movie or person isn&apos;t in Kovarboxd. It may be below the popularity cutoff, or gone from TMDB.
      </p>
      <p>
        <Link href="/">Back to the start</Link>
      </p>
    </section>
  );
}
