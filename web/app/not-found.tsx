import Link from "next/link";
import { Burst, Slab } from "@/components/Jumpsuit";

// Unknown URLs. A missing movie or person uses (site)/not-found.tsx, which keeps the header.
export default function NotFound() {
  return (
    <main>
      <section className="hero">
        <Slab>
          <h1 className="big cutT">Nothing here.</h1>
          <p>There&apos;s nothing at this address.</p>
          <div className="examples">
            <Link href="/">Back to the start</Link>
          </div>
        </Slab>
        <div className="hero-side">
          <Burst value="404" />
        </div>
      </section>
    </main>
  );
}
