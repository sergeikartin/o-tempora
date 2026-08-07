import type {
  Category,
  DiscoveryCategory,
  Person,
  War,
  WarEvent,
  WarsAndConflictsEntry,
  Discovery,
  ReignPeriod,
  YearMonth,
} from "@same-sky/shared-types";
import type { TaggedPerson, TaggedEvent, TaggedDiscovery } from "../transform/index.js";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

// month absent means year-only precision — see shared-types's YearMonth.
function yearMonth(year: number, month: number | undefined): YearMonth {
  return month === undefined ? { year } : { year, month };
}

function optionalYearMonth(year: number | undefined, month: number | undefined): YearMonth | undefined {
  return year === undefined ? undefined : yearMonth(year, month);
}

interface ValidatedEventRow<C> {
  name: string;
  article: string;
  description: string;
  year: number;
  month?: number;
  category: C;
}

// Shared by buildWars/buildDiscoveries — both lanes require the same five
// fields before an entry is worth keeping; only what they build from a
// validated row (Period/PointInTime split, partOfWarName) differs, and
// each lane has its own category type (Category for Wars, DiscoveryCategory
// for Discoveries — see packages/shared-types), hence the type param.
function validateEventRow<C>(
  row: { label?: string; article?: string; description?: string; year?: number; month?: number; category?: C },
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
  return {
    name: row.label,
    article: row.article,
    description: row.description,
    year: row.year,
    month: row.month,
    category: row.category,
  };
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
      lifespan: {
        start: yearMonth(row.birthyear, row.birthmonth),
        end: optionalYearMonth(row.deathyear, row.deathmonth),
      },
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

// Only wars (wd:Q198) become a War (a real Period) — see WAR_TYPE_QID and
// the War/WarEvent split in shared-types. Everything else in the lane
// (battles, treaties, sieges, revolutions, rebellions, military
// operations, generic historical events) becomes a WarEvent (a
// PointInTime), even when the row happens to carry a secondaryYear/Month
// (from the same ?endDate/P582 binding every event type shares) — only
// wars read it, per the product decision that only wars render as range
// bars.
export function buildWars(rows: TaggedEvent[]): { entries: WarsAndConflictsEntry[]; report: DropReport } {
  const entries: WarsAndConflictsEntry[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    const validated = validateEventRow<Category>(row, reasons);
    if (!validated) continue;

    const shared = {
      id: row.id,
      name: validated.name,
      partOfWarName: row.partOfLabel,
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: validated.description,
      wikipediaUrl: validated.article,
    };

    if (row.tags.includes(WAR_TYPE_QID)) {
      const war: War = {
        ...shared,
        period: {
          start: yearMonth(validated.year, validated.month),
          end: optionalYearMonth(row.secondaryYear, row.secondaryMonth),
        },
      };
      entries.push(war);
    } else {
      const warEvent: WarEvent = { ...shared, at: yearMonth(validated.year, validated.month) };
      entries.push(warEvent);
    }
  }

  return { entries, report: { dropped: rows.length - entries.length, reasons } };
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
      // Curated events have no month source (data/raw/events-curated.raw.json
      // is year-only) — always year precision, unlike Wars & Conflicts.
      at: yearMonth(validated.year, validated.month),
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.sitelinks,
      description: validated.description,
      wikipediaUrl: validated.article,
    });
  }

  return { discoveries, report: { dropped: rows.length - discoveries.length, reasons } };
}
