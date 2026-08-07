import type { Category, DiscoveryCategory, Person, War, Discovery, ReignPeriod } from "@same-sky/shared-types";
import type { TaggedPerson, TaggedEvent, TaggedDiscovery } from "../transform/index.js";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

interface ValidatedEventRow<C> {
  name: string;
  article: string;
  description: string;
  year: number;
  category: C;
}

// Shared by buildWars/buildDiscoveries — both lanes require the same five
// fields before an entry is worth keeping; only what they build from a
// validated row (endYear/partOfWarName vs. not) differs, and each lane has
// its own category type (Category for Wars, DiscoveryCategory for
// Discoveries — see packages/shared-types), hence the type param.
function validateEventRow<C>(
  row: { label?: string; article?: string; description?: string; year?: number; category?: C },
  reasons: Record<string, number>,
): ValidatedEventRow<C> | undefined {
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
// clearly-wrong upstream data (mirrors the same guard the old Wikidata
// pipeline needed) rather than rendering an obviously-broken, centuries-
// wide bar.
const MAX_PLAUSIBLE_LIFESPAN_YEARS = 130;

// Output is the last chance to catch a schema violation before the frontend
// ever sees this data. wikipediaUrl needs no presence check here — it's
// derived deterministically from Pantheon's slug column, which
// parsePantheonCsv already guarantees is non-empty. reignsByPersonId is
// keyed on Wikidata QID (row.wdId), not Pantheon's own id — currently
// always empty (see People: reign-period secondary enrichment,
// .scratch/alt-data-sources/issues/19-people-reign-periods-enrichment.md,
// which will populate it), but wired to the correct key now.
export function buildPeople(
  rows: TaggedPerson[],
  reignsByPersonId: Map<string, ReignPeriod[]> = new Map(),
): { people: Person[]; report: DropReport } {
  const people: Person[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    if (!row.description) {
      record(reasons, "missing description");
      continue;
    }
    if (row.birthyear === undefined) {
      record(reasons, "missing birth year");
      continue;
    }
    if (
      row.deathyear !== undefined &&
      (row.deathyear < row.birthyear || row.deathyear - row.birthyear > MAX_PLAUSIBLE_LIFESPAN_YEARS)
    ) {
      record(reasons, "implausible lifespan");
      continue;
    }
    if (!row.occupationDomain) {
      record(reasons, "no mappable occupation domain");
      continue;
    }

    people.push({
      id: row.id,
      name: row.name,
      startYear: row.birthyear,
      endYear: row.deathyear,
      occupationDomain: row.occupationDomain,
      regionTags: row.regionTags,
      fameScore: row.hpi,
      description: row.description,
      wikipediaUrl: row.wikipediaUrl,
      reignPeriods: reignsByPersonId.get(row.wdId),
    });
  }

  return { people, report: { dropped: rows.length - people.length, reasons } };
}

export function buildWars(rows: TaggedEvent[]): { wars: War[]; report: DropReport } {
  const wars: War[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    const validated = validateEventRow<Category>(row, reasons);
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

// sitelinks<=0 means fetch-events-enrichment.ts's SPARQL pass couldn't
// resolve this curated QID (see transformDiscoveries's `?? 0` coercion) —
// dropped here rather than treated as a genuinely-zero-sitelink item, per
// the map's enrichment-failure-handling decision.
export function buildDiscoveries(rows: TaggedDiscovery[]): { discoveries: Discovery[]; report: DropReport } {
  const discoveries: Discovery[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    const validated = validateEventRow<DiscoveryCategory>(row, reasons);
    if (!validated) continue;
    if (row.sitelinks <= 0) {
      record(reasons, "missing sitelinks (enrichment failed)");
      continue;
    }

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
