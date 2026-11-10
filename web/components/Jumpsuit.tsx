import type { CSSProperties, ReactNode } from "react";

// The shared pieces of the design. No server-only imports, so client pages
// like error.tsx can use them too.

/** The black paper slab that carries a page's subject. */
export function Slab({ children }: { children: ReactNode }) {
  return (
    <div className="slabw">
      <div className="slabbg cut">
        <i />
      </div>
      <div className="sl">{children}</div>
    </div>
  );
}

const STAR =
  "100,4 118,48 158,18 150,66 197,62 160,96 196,128 148,130 164,182 118,150 98,197 82,150 34,178 50,128 3,126 42,96 10,58 56,66 44,16 84,48";

/** The red star. Each page gets one, holding its key number. */
export function Burst({ value }: { value: string | number }) {
  const text = String(value);
  // A percent of the star's width, so the text always fits inside it.
  const size = text.length <= 2 ? 47 : text.length === 3 ? 35 : text.length === 4 ? 25 : 20;
  return (
    <div className="burst">
      <svg className="cut" viewBox="0 0 200 200" aria-hidden="true">
        <polygon fill="#e30613" points={STAR} />
      </svg>
      <b style={{ "--n": size } as CSSProperties}>{text}</b>
    </div>
  );
}

export function LabelRow({ name, value }: { name: string; value: ReactNode }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** Ruled name and value rows, like the label on a film box. Rows with no value are left out. */
export function BoxLabel({ rows, children }: { rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <dl className="lbl">
      {rows
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([name, value]) => (
          <LabelRow key={name} name={name} value={value} />
        ))}
      {children}
    </dl>
  );
}

export function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="sect">
      <h2>{title}</h2>
      {note && <span>{note}</span>}
    </div>
  );
}

/** Long titles step down a size so a single word doesn't overflow the slab. */
export function bigSize(text: string): string {
  return text.length > 26 ? "big s cutT" : text.length > 14 ? "big m cutT" : "big cutT";
}
