// Display helpers. Dates from Postgres arrive as "YYYY-MM-DD" strings and are
// formatted in UTC so a date never shifts by a day.

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string | null): string | null {
  return iso ? LONG_DATE.format(new Date(`${iso}T00:00:00Z`)) : null;
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function formatMoney(amount: number | null): string | null {
  return amount ? `$${amount.toLocaleString("en-US")}` : null;
}

/** Whole years between two "YYYY-MM-DD" dates. */
export function ageBetween(birthday: string, until: string): number {
  const [by, bm, bd] = birthday.split("-").map(Number);
  const [uy, um, ud] = until.split("-").map(Number);
  return uy - by - (um < bm || (um === bm && ud < bd) ? 1 : 0);
}

const LANGUAGES = new Intl.DisplayNames(["en"], { type: "language" });

export function languageName(code: string | null): string | null {
  if (!code) return null;
  try {
    return LANGUAGES.of(code) ?? code;
  } catch {
    return code;
  }
}
