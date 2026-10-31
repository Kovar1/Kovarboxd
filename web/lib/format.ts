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

/** "Born ... in ... (age N)" and "Died ... (aged N)" lines for a person page. */
export function lifeFacts(
  p: { birthday: string | null; deathday: string | null; place_of_birth: string | null },
  today: string,
): string[] {
  const facts: string[] = [];
  const where = p.place_of_birth ? ` in ${p.place_of_birth}` : "";
  if (p.birthday) {
    const born = `Born ${formatDate(p.birthday)}${where}`;
    facts.push(p.deathday ? born : `${born} (age ${ageBetween(p.birthday, today)})`);
  } else if (p.place_of_birth) {
    facts.push(`Born${where}`);
  }
  if (p.deathday) {
    const age = p.birthday ? ` (aged ${ageBetween(p.birthday, p.deathday)})` : "";
    facts.push(`Died ${formatDate(p.deathday)}${age}`);
  }
  return facts;
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
