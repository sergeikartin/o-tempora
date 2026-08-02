import type { Person, HistoricalEvent } from "@same-sky/shared-types";
import type { TaggedPerson, TaggedEvent } from "../transform/index.js";

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

// Output is the last chance to catch a schema violation before the frontend
// ever sees this data — validated here even though most of these should be
// structurally impossible given Fetch's own required fields.
export function buildPeople(rows: TaggedPerson[]): { people: Person[]; report: DropReport } {
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
      category: row.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: row.description,
      wikipediaUrl: row.article,
    });
  }

  return { events, report: { dropped: rows.length - events.length, reasons } };
}
