// Crooked scissor-cut outlines for posters and bars. These replace a live SVG
// filter, which would be slow across a wall of posters. The same seed always
// gives the same outline, so a film keeps its shape everywhere.

function generator(seed: number): () => number {
  let a = Math.imul(seed || 1, 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A CSS clip-path polygon: a rectangle with each edge wobbling inward by up to `amount` percent. */
export function cutOutline(seed: number, amount = 1.7): string {
  const next = generator(seed);
  const inset = () => (next() * amount).toFixed(2);
  const across = 6;
  const down = 8;
  const points: string[] = [];
  for (let i = 0; i <= across; i++) points.push(`${((i / across) * 100).toFixed(1)}% ${inset()}%`);
  for (let i = 1; i < down; i++) points.push(`${(100 - +inset()).toFixed(2)}% ${((i / down) * 100).toFixed(1)}%`);
  for (let i = across; i >= 0; i--) points.push(`${((i / across) * 100).toFixed(1)}% ${(100 - +inset()).toFixed(2)}%`);
  for (let i = down - 1; i > 0; i--) points.push(`${inset()}% ${((i / down) * 100).toFixed(1)}%`);
  return `polygon(${points.join(",")})`;
}
