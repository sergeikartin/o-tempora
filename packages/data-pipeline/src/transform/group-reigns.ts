import type { ReignPeriod } from "@same-sky/shared-types";
import type { SparqlBinding } from "../fetch/sparql-result-shape.js";

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

// Wikidata dateTime literals are ISO 8601 with a signed year (see
// group-rows.ts's parseIsoYear for the fuller rationale) — duplicated here
// rather than imported, since people-reigns.raw.json's shape (person id +
// bare start/end years, one row per position held, not collapsed into a
// single grouped record) doesn't fit groupRows()'s "one row per entity"
// contract at all; this is a genuinely different grouping shape, not a
// variant of it.
function parseIsoYear(iso: string): number | undefined {
  const match = /^(-?\d+)-\d{2}-\d{2}/.exec(iso);
  if (!match || match[1] === undefined) return undefined;
  return Number(match[1]);
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

    const startYear = parseIsoYear(startIso);
    if (startYear === undefined) continue;

    const endIso = row.reignEnd?.value;
    const endYear = endIso ? parseIsoYear(endIso) : undefined;
    const title = row.positionLabel?.value;

    const periods = grouped.get(personId) ?? [];
    if (!periods.some((p) => p.startYear === startYear && p.endYear === endYear)) {
      periods.push({ startYear, endYear, title });
    }
    grouped.set(personId, periods);
  }

  for (const periods of grouped.values()) {
    periods.sort((a, b) => a.startYear - b.startYear);
  }

  return grouped;
}
