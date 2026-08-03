import type { Person, HistoricalEvent, ReignPeriod } from "@same-sky/shared-types";
import type { TaggedPerson, TaggedEvent } from "../transform/index.js";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
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
      birthYear: row.year,
      deathYear: row.secondaryYear,
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

export function buildEvents(rows: TaggedEvent[]): { events: HistoricalEvent[]; report: DropReport } {
  const events: HistoricalEvent[] = [];
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
      record(reasons, "missing date");
      continue;
    }
    if (!row.category) {
      record(reasons, "no mappable event category");
      continue;
    }

    events.push({
      id: row.id,
      name: row.label,
      date: row.year,
      // Only wars (wd:Q198) get range-bar treatment — see WAR_TYPE_QID.
      // row.secondaryYear is populated from the same ?endDate (P582)
      // binding for every event type, but deliberately only read here for
      // wars, so a battle/treaty that happens to carry a P582 claim still
      // renders as a single point.
      endDate: row.tags.includes(WAR_TYPE_QID) ? row.secondaryYear : undefined,
      partOfWarName: row.partOfLabel,
      category: row.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: row.description,
      wikipediaUrl: row.article,
    });
  }

  return { events, report: { dropped: rows.length - events.length, reasons } };
}
