// Small helpers for laying out search results.

function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * True when every word typed starts a word of the name: "tom han" matches
 * "Tom Hanks", "godfahter" doesn't match "Peter Godfrey". The search page
 * lists people above movies only for a match like this.
 */
export function strongNameMatch(query: string, name: string): boolean {
  const typed = words(query);
  const nameWords = words(name);
  return typed.length > 0 && typed.every((t) => nameWords.some((w) => w.startsWith(t)));
}
