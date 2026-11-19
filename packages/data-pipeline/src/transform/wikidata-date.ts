// Wikidata’s signed ISO dateTime years already use astronomical numbering.

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

export function parseMonthIfKnown(
  iso: string,
  precisionValue: string | undefined,
): number | undefined {
  if (precisionValue === undefined) return undefined;
  if (Number(precisionValue) < MONTH_OR_FINER_PRECISION) return undefined;
  return parseIsoMonth(iso);
}
