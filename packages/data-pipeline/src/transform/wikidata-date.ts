// Shared by group-rows.ts and group-reigns.ts — both parse the same
// Wikidata ISO-8601 dateTime literal shape (e.g. "-0493-01-01T00:00:00Z"
// for 493 BCE, "1995-11-12T00:00:00Z" for CE), already matching
// Temporal.PlainDate's own signed-year convention (Invariant 4). The two
// callers still keep their own grouping logic separate (genuinely
// different shapes — see group-reigns.ts's comment), but the low-level
// ISO-string parsing itself is identical, so it lives here once.

export function parseIsoYear(iso: string): number | undefined {
  const match = /^(-?\d+)-\d{2}-\d{2}/.exec(iso);
  if (!match || match[1] === undefined) return undefined;
  return Number(match[1]);
}

export function parseIsoMonth(iso: string): number | undefined {
  const match = /^-?\d+-(\d{2})-\d{2}/.exec(iso);
  if (!match || match[1] === undefined) return undefined;
  return Number(match[1]);
}

// Wikidata's own precision codes (https://www.wikidata.org/wiki/Help:Dates):
// 11 = day, 10 = month, 9 = year. A "01" month/day in the ISO value below
// this threshold is Wikidata's own placeholder for "unknown", not a real
// date component — must not be surfaced as one.
export const MONTH_OR_FINER_PRECISION = 10;

// `undefined` precisionValue means the caller didn't bind a precision
// variable at all (see GroupRowsConfig's datePrecisionVar) — no month
// either way.
export function parseMonthIfKnown(iso: string, precisionValue: string | undefined): number | undefined {
  if (precisionValue === undefined) return undefined;
  if (Number(precisionValue) < MONTH_OR_FINER_PRECISION) return undefined;
  return parseIsoMonth(iso);
}
