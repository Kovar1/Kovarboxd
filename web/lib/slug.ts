// URLs carry the TMDb id plus a readable slug: /movie/769-goodfellas.
// Only the id matters for lookups. A missing or stale slug redirects to the
// current one, so links stay valid when a title changes on TMDb.

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function withSlug(prefix: string, id: number, text: string): string {
  const slug = slugify(text);
  return slug ? `${prefix}/${id}-${slug}` : `${prefix}/${id}`;
}

export function moviePath(id: number, title: string): string {
  return withSlug("/movie", id, title);
}

export function personPath(id: number, name: string): string {
  return withSlug("/person", id, name);
}

/** "769-goodfellas" or "769" to 769. Anything else is null. */
export function parseIdParam(param: string): number | null {
  const match = /^(\d{1,9})(?:-|$)/.exec(param);
  return match ? Number(match[1]) : null;
}
