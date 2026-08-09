import type {
  ConflictCategory,
  DiscoveryCategory,
  Person,
  War,
  WarEvent,
  WarsAndConflictsEntry,
  Discovery,
  ReignPeriod,
  YearMonth,
} from "@same-sky/shared-types";
import type { TaggedPerson, TaggedWar, TaggedDiscovery } from "../transform/index.js";

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
// validated row (the Period/PointInTime split) differs, and
// each lane has its own category type (ConflictCategory for Wars,
// DiscoveryCategory for Discoveries — see packages/shared-types), hence the
// type param.
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
    if (row.deathyear === undefined && !row.alive) {
      // A missing deathyear means "ongoing" per Period's contract (see
      // shared-types) — true only for a confirmed-alive person. Pantheon
      // also omits deathyear for people whose death date is simply
      // unrecorded (e.g. Jack the Ripper, never identified), which isn't
      // "ongoing" and shouldn't render through to today.
      record(reasons, "no deathyear and not confirmed alive");
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
      ...(row.image ? { image: row.image } : {}),
      ...(row.imageAttribution ? { imageAttribution: row.imageAttribution } : {}),
    });
  }

  return { people, report: { dropped: rows.length - people.length, reasons } };
}

// A curated row's `parentId` chain, validated depth-first from `id` up to
// its root: every ancestor must exist among the rows that already survived
// validation (built), every ancestor beyond `id` itself must be a War (a
// WarEvent can never have children — see shared-types's parentId doc
// comment), and the chain (Container → level 2 → level 3) is capped at 3
// entries deep. Naturally loop-safe with no separate cycle guard needed — a
// cyclic chain still increments depth every iteration, so it's caught by
// the depth check within 4 iterations regardless of whether it would
// otherwise terminate.
function validateParentChain(
  id: string,
  built: ReadonlyMap<string, WarsAndConflictsEntry>,
): { ok: true } | { ok: false; reason: string } {
  let currentId: string | undefined = id;
  let depth = 0;

  while (currentId !== undefined) {
    const current = built.get(currentId);
    if (!current) return { ok: false, reason: "parentId not found" };
    depth += 1;
    if (depth > 3) return { ok: false, reason: "nesting depth exceeded" };
    if (currentId !== id && !("period" in current)) return { ok: false, reason: "parentId is not a War" };
    currentId = current.parentId;
  }

  return { ok: true };
}

// Shape follows what the curated row's Wikidata enrichment actually
// resolved, not `category` — a row with both a start and an end date
// becomes a War (a real Period); a row with only one becomes a WarEvent (a
// PointInTime); a row with neither is dropped as an enrichment failure. See
// shared-types's War/WarEvent doc comments.
export function buildWars(rows: TaggedWar[]): { entries: WarsAndConflictsEntry[]; report: DropReport } {
  const reasons: Record<string, number> = {};
  const built = new Map<string, WarsAndConflictsEntry>();

  for (const row of rows) {
    const validated = validateEventRow<ConflictCategory>(row, reasons);
    if (!validated) continue;
    if (row.sitelinks <= 0) {
      record(reasons, "missing sitelinks (enrichment failed)");
      continue;
    }

    const shared = {
      id: row.id,
      name: validated.name,
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.fameScore,
      description: validated.description,
      wikipediaUrl: validated.article,
      ...(row.image ? { image: row.image } : {}),
      ...(row.imageAttribution ? { imageAttribution: row.imageAttribution } : {}),
      ...(row.parentId ? { parentId: row.parentId } : {}),
    };

    if (row.endYear !== undefined) {
      const war: War = {
        ...shared,
        period: {
          start: yearMonth(validated.year, validated.month),
          end: yearMonth(row.endYear, row.endMonth),
        },
      };
      built.set(row.id, war);
    } else {
      const warEvent: WarEvent = { ...shared, at: yearMonth(validated.year, validated.month) };
      built.set(row.id, warEvent);
    }
  }

  const entries: WarsAndConflictsEntry[] = [];
  for (const [id, entry] of built) {
    const result = validateParentChain(id, built);
    if (result.ok) {
      entries.push(entry);
    } else {
      record(reasons, result.reason);
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
      fameScore: row.fameScore,
      description: validated.description,
      wikipediaUrl: validated.article,
      ...(row.image ? { image: row.image } : {}),
      ...(row.imageAttribution ? { imageAttribution: row.imageAttribution } : {}),
    });
  }

  return { discoveries, report: { dropped: rows.length - discoveries.length, reasons } };
}
