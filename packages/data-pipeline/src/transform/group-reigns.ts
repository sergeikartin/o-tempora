import type { ReignPeriod, YearMonth } from "@same-sky/shared-types";
import type { SparqlBinding } from "../fetch/sparql-result-shape.js";
import { parseIsoYear, parseMonthIfKnown } from "./wikidata-date.js";

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

// people-reigns.raw.json's shape (person id + bare start/end years, one row
// per position held, not collapsed into a single grouped record) doesn't
// fit groupRows()'s "one row per entity" contract at all — this is a
// genuinely different grouping shape, not a variant of it, so the grouping
// logic below stays separate from group-rows.ts's; only the low-level ISO
// string parsing itself (identical either way) is shared, via
// wikidata-date.ts.
function parseYearMonth(iso: string, precisionValue: string | undefined): YearMonth {
  const year = parseIsoYear(iso) as number; // caller already confirmed this parses
  const month = parseMonthIfKnown(iso, precisionValue);
  return month === undefined ? { year } : { year, month };
}

function yearMonthEquals(a: YearMonth | undefined, b: YearMonth | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.year === b.year && a.month === b.month;
}

// Unlike groupRows() (first-value-wins per entity), a person can genuinely
// have more than one reign/term — every distinct (start, end) pair is kept,
// sorted ascending by start year. Rows missing a start year are dropped
// (Wikidata occasionally has a qualified P39 statement with only P582
// bound); an event with no reign data at all is simply absent from the map,
// not an empty array.
export function groupReigns(bindings: SparqlBinding[]): Map<string, ReignPeriod[]> {
  const grouped = new Map<string, ReignPeriod[]>();

  for (const row of bindings) {
    const personUri = row.person?.value;
    const startIso = row.reignStart?.value;
    if (!personUri || !startIso) continue;

    const match = ENTITY_URI_PATTERN.exec(personUri);
    if (!match?.[1]) continue;
    const personId = match[1];

    if (parseIsoYear(startIso) === undefined) continue;
    const start = parseYearMonth(startIso, row.reignStartPrecision?.value);

    const endIso = row.reignEnd?.value;
    const end = endIso && parseIsoYear(endIso) !== undefined ? parseYearMonth(endIso, row.reignEndPrecision?.value) : undefined;
    const title = row.positionLabel?.value;

    const periods = grouped.get(personId) ?? [];
    if (!periods.some((p) => yearMonthEquals(p.start, start) && yearMonthEquals(p.end, end))) {
      periods.push({ start, end, title });
    }
    grouped.set(personId, periods);
  }

  for (const periods of grouped.values()) {
    periods.sort((a, b) => a.start.year - b.start.year);
  }

  return grouped;
}
