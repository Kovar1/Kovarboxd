import Link from "next/link";

// Unknown URLs. A missing movie or person uses (site)/not-found.tsx, which keeps the header.
export default function NotFound() {
  return (
    <main>
      <section className="message-page">
        <h1>Not found</h1>
        <p className="sub">There&apos;s nothing at this address.</p>
        <p>
          <Link href="/">Back to the start</Link>
        </p>
      </section>
    </main>
  );
}
