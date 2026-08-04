import type { Category, Person, War, Discovery, ReignPeriod } from "@same-sky/shared-types";
import type { TaggedPerson, TaggedEvent } from "../transform/index.js";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

interface ValidatedEventRow {
  name: string;
  article: string;
  description: string;
  year: number;
  category: Category;
}

// Shared by buildWars/buildDiscoveries — both lanes require the same five
// fields before an entry is worth keeping; only what they build from a
// validated row (endYear/partOfWarName vs. not) differs.
function validateEventRow(row: TaggedEvent, reasons: Record<string, number>): ValidatedEventRow | undefined {
  if (!row.label) {
    record(reasons, "missing name");
    return undefined;
  }
  if (!row.article) {
    record(reasons, "missing Wikipedia article");
    return undefined;
  }
  if (!row.description) {
    record(reasons, "missing description");
    return undefined;
  }
  if (row.year === undefined) {
    record(reasons, "missing date");
    return undefined;
  }
  if (!row.category) {
    record(reasons, "no mappable event category");
    return undefined;
  }
  return { name: row.label, article: row.article, description: row.description, year: row.year, category: row.category };
}

// Above the longest verified human lifespan (Jeanne Calment, 122 years) —
// leaves slack for real date-precision edge cases, while still catching
// clearly-wrong upstream Wikidata claims (e.g. William McMaster Murdoch's
// P569 birth-date statement giving year 2 instead of 1873) rather than
// rendering an obviously-broken, centuries-wide bar.
const MAX_PLAUSIBLE_LIFESPAN_YEARS = 130;

// Output is the last chance to catch a schema violation before the frontend
// ever sees this data — validated here even though most of these should be
// structurally impossible given Fetch's own required fields.
export function buildPeople(
  rows: TaggedPerson[],
  reignsByPersonId: Map<string, ReignPeriod[]> = new Map(),
): { people: Person[]; report: DropReport } {
  const people: Person[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    if (!row.label) {
      record(reasons, "missing name");
      continue;
    }
    if (!row.article) {
      record(reasons, "missing Wikipedia article");
      continue;
    }
    if (!row.description) {
      record(reasons, "missing description");
      continue;
    }
    if (row.year === undefined) {
      record(reasons, "missing birth date");
      continue;
    }
    if (
      row.secondaryYear !== undefined &&
      (row.secondaryYear < row.year || row.secondaryYear - row.year > MAX_PLAUSIBLE_LIFESPAN_YEARS)
    ) {
      record(reasons, "implausible lifespan");
      continue;
    }
    if (!row.category) {
      record(reasons, "no mappable occupation category");
      continue;
    }

    people.push({
      id: row.id,
      name: row.label,
      startYear: row.year,
      endYear: row.secondaryYear,
      category: row.category,
      occupationTags: row.occupationTags,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: row.description,
      wikipediaUrl: row.article,
      reignPeriods: reignsByPersonId.get(row.id),
    });
  }

  return { people, report: { dropped: rows.length - people.length, reasons } };
}

export function buildWars(rows: TaggedEvent[]): { wars: War[]; report: DropReport } {
  const wars: War[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    const validated = validateEventRow(row, reasons);
    if (!validated) continue;

    wars.push({
      id: row.id,
      name: validated.name,
      startYear: validated.year,
      // Only wars (wd:Q198) get range-bar treatment — see WAR_TYPE_QID.
      // row.secondaryYear is populated from the same ?endDate (P582)
      // binding for every event type, but deliberately only read here for
      // wars, so a battle/treaty that happens to carry a P582 claim still
      // renders as a single point.
      endYear: row.tags.includes(WAR_TYPE_QID) ? row.secondaryYear : undefined,
      partOfWarName: row.partOfLabel,
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: validated.description,
      wikipediaUrl: validated.article,
    });
  }

  return { wars, report: { dropped: rows.length - wars.length, reasons } };
}

export function buildDiscoveries(rows: TaggedEvent[]): { discoveries: Discovery[]; report: DropReport } {
  const discoveries: Discovery[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    const validated = validateEventRow(row, reasons);
    if (!validated) continue;

    discoveries.push({
      id: row.id,
      name: validated.name,
      startYear: validated.year,
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: validated.description,
      wikipediaUrl: validated.article,
    });
  }

  return { discoveries, report: { dropped: rows.length - discoveries.length, reasons } };
}
