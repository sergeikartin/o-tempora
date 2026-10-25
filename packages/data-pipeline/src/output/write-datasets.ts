import type {
  Conflict,
  ConflictCategory,
  ConflictEntry,
  ConflictEvent,
  Milestone,
  MilestoneCategory,
  Person,
  YearMonth,
} from '@o-tempora/shared-types';
import type {
  TaggedConflict,
  TaggedMilestone,
  TaggedPerson,
} from '../transform/index.js';
import { imageFields } from './image-fields.js';

// What the builders return: an entry before `slug` is attached. A slug is
// unique across every lane (slugs.ts), so it can only be assigned once all
// lanes are built.
export type Unslugged<T> = T extends unknown ? Omit<T, 'slug'> : never;

export interface DropReport {
  dropped: number;
  reasons: Record<string, number>;
}

// The two languages a dataset file is built for. Row inclusion (sitelinks,
// tagline presence, date resolution, parentId chains) is decided once from each
// row's English fields regardless of `lang` (see buildConflicts); only the
// per-field text (name/tagline/description) varies, falling back to English
// where the Russian value didn't resolve. Both files therefore share the same
// entity set.
export type Lang = 'en' | 'ru';

// Picks the Russian value when building the Russian output and it resolved,
// English otherwise: the one fallback rule for every language-varying field.
function resolveField(en: string, ru: string | undefined, lang: Lang): string {
  return lang === 'ru' ? (ru ?? en) : en;
}

// Same rule as resolveField, for fields (like description) that are optional
// in English too; never gates row inclusion.
function resolveOptionalField(
  en: string | undefined,
  ru: string | undefined,
  lang: Lang,
): string | undefined {
  return lang === 'ru' ? (ru ?? en) : en;
}

function record(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

// An absent month means year-only precision (shared-types's YearMonth).
function yearMonth(year: number, month: number | undefined): YearMonth {
  return month === undefined ? { year } : { year, month };
}

function optionalYearMonth(
  year: number | undefined,
  month: number | undefined,
): YearMonth | undefined {
  return year === undefined ? undefined : yearMonth(year, month);
}

interface ValidatedEventRow<C> {
  name: string;
  article: string;
  tagline: string;
  year: number;
  month?: number;
  category: C;
}

// Shared by buildConflicts/buildMilestones: both require the same five fields
// before keeping an entry; only what is built from a validated row (the
// Period/PointInTime split) differs, and each lane has its own category type
// (hence the type param).
function validateEventRow<C>(
  row: {
    label?: string;
    article?: string;
    tagline?: string;
    year?: number;
    month?: number;
    category?: C;
  },
  reasons: Record<string, number>,
): ValidatedEventRow<C> | undefined {
  if (!row.label) {
    record(reasons, 'missing name');
    return undefined;
  }
  if (!row.article) {
    record(reasons, 'missing Wikipedia article');
    return undefined;
  }
  if (!row.tagline) {
    record(reasons, 'missing tagline');
    return undefined;
  }
  if (row.year === undefined) {
    record(reasons, 'missing date');
    return undefined;
  }
  if (!row.category) {
    record(reasons, 'no mappable event category');
    return undefined;
  }
  return {
    name: row.label,
    article: row.article,
    tagline: row.tagline,
    year: row.year,
    month: row.month,
    category: row.category,
  };
}

// Above the longest verified human lifespan (Jeanne Calment, 122 years): slack
// for date-precision edge cases, while catching clearly wrong upstream data
// instead of rendering a centuries-wide bar.
const MAX_PLAUSIBLE_LIFESPAN_YEARS = 130;

// Output is the last chance to catch a schema violation before the frontend.
// wikipediaUrl needs no presence check: it derives from Pantheon's slug column,
// which parsePantheonCsv guarantees is non-empty.
export function buildPeople(
  rows: TaggedPerson[],
  lang: Lang = 'en',
): { people: Unslugged<Person>[]; report: DropReport } {
  const people: Unslugged<Person>[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    // Inclusion is gated on the English name/tagline regardless of `lang` (see
    // Lang).
    if (!row.name) {
      record(reasons, 'missing name');
      continue;
    }
    if (!row.tagline) {
      record(reasons, 'missing tagline');
      continue;
    }
    if (row.birthyear === undefined) {
      record(reasons, 'missing birth year');
      continue;
    }
    if (row.deathyear === undefined && !row.alive) {
      // A missing deathyear means "ongoing" (Period's contract) only for a
      // confirmed-alive person. Pantheon also omits deathyear when the death is
      // unrecorded (e.g. Jack the Ripper), which isn't "ongoing" and shouldn't render
      // through to today.
      record(reasons, 'no deathyear and not confirmed alive');
      continue;
    }
    if (
      row.deathyear !== undefined &&
      (row.deathyear < row.birthyear ||
        row.deathyear - row.birthyear > MAX_PLAUSIBLE_LIFESPAN_YEARS)
    ) {
      record(reasons, 'implausible lifespan');
      continue;
    }
    if (!row.occupationDomain) {
      record(reasons, 'no mappable occupation domain');
      continue;
    }

    const description = resolveOptionalField(
      row.description,
      row.descriptionRu,
      lang,
    );
    people.push({
      id: row.id,
      name: resolveField(row.name, row.nameRu, lang),
      lifespan: {
        start: yearMonth(row.birthyear, row.birthmonth),
        end: optionalYearMonth(row.deathyear, row.deathmonth),
      },
      occupationDomain: row.occupationDomain,
      regionTags: row.regionTags,
      fameScore: row.hpi,
      tagline: resolveField(row.tagline, row.taglineRu, lang),
      wikipediaUrl: row.wikipediaUrl,
      ...imageFields(row.id, row.image, row.imageAttribution),
      ...(description ? { description } : {}),
    });
  }

  return { people, report: { dropped: rows.length - people.length, reasons } };
}

// A curated row's `parentId` chain, validated up from `id` to its root: every
// ancestor must exist among the rows that survived validation (built), every
// ancestor beyond `id` must be a Conflict (a ConflictEvent can't have
// children; see shared-types's parentId), and the chain (Container → level 2 →
// level 3) is capped at 3 entries. Loop-safe without a cycle guard: a cycle
// keeps incrementing depth and trips the cap within 4 iterations.
function validateParentChain(
  id: string,
  built: ReadonlyMap<string, Unslugged<ConflictEntry>>,
): { ok: true } | { ok: false; reason: string } {
  let currentId: string | undefined = id;
  let depth = 0;

  while (currentId !== undefined) {
    const current = built.get(currentId);
    if (!current) return { ok: false, reason: 'parentId not found' };
    depth += 1;
    if (depth > 3) return { ok: false, reason: 'nesting depth exceeded' };
    if (currentId !== id && !('period' in current))
      return { ok: false, reason: 'parentId is not a Conflict' };
    currentId = current.parentId;
  }

  return { ok: true };
}

// Shape follows what enrichment resolved, not `category`: both a start and an
// end date make a Conflict (a Period), one makes a ConflictEvent (a
// PointInTime), neither drops the row as an enrichment failure (shared-types's
// Conflict/ConflictEvent).
export function buildConflicts(
  rows: TaggedConflict[],
  lang: Lang = 'en',
): { entries: Unslugged<ConflictEntry>[]; report: DropReport } {
  const reasons: Record<string, number> = {};
  const built = new Map<string, Unslugged<ConflictEntry>>();

  for (const row of rows) {
    // Inclusion is gated on English fields (validated.name/tagline come from
    // row.label/row.tagline, never the Ru variants); see Lang.
    const validated = validateEventRow<ConflictCategory>(row, reasons);
    if (!validated) continue;
    if (row.sitelinks <= 0) {
      record(reasons, 'missing sitelinks (enrichment failed)');
      continue;
    }

    const description = resolveOptionalField(
      row.description,
      row.descriptionRu,
      lang,
    );
    const shared = {
      id: row.id,
      name: resolveField(validated.name, row.labelRu, lang),
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.fameScore,
      tagline: resolveField(validated.tagline, row.taglineRu, lang),
      wikipediaUrl: validated.article,
      ...imageFields(row.id, row.image, row.imageAttribution),
      ...(description ? { description } : {}),
      ...(row.parentId ? { parentId: row.parentId } : {}),
    };

    if (row.endYear !== undefined) {
      const conflict: Unslugged<Conflict> = {
        ...shared,
        period: {
          start: yearMonth(validated.year, validated.month),
          end: yearMonth(row.endYear, row.endMonth),
        },
      };
      built.set(row.id, conflict);
    } else {
      const conflictEvent: Unslugged<ConflictEvent> = {
        ...shared,
        at: yearMonth(validated.year, validated.month),
      };
      built.set(row.id, conflictEvent);
    }
  }

  const entries: Unslugged<ConflictEntry>[] = [];
  for (const [id, entry] of built) {
    const result = validateParentChain(id, built);
    if (result.ok) {
      entries.push(entry);
    } else {
      record(reasons, result.reason);
    }
  }

  return {
    entries,
    report: { dropped: rows.length - entries.length, reasons },
  };
}

// sitelinks<=0 means fetch-milestones-enrichment.ts couldn't resolve this QID
// (transformMilestones's `?? 0`), so the row is dropped rather than treated as
// a zero-sitelink item.
//
// Shape follows what enrichment resolved, not `category` (as in buildConflicts):
// a resolved endYear (P582) makes a period-shaped Milestone (e.g. the Black
// Death, 1346-1353), otherwise a point (shared-types's Milestone).
export function buildMilestones(
  rows: TaggedMilestone[],
  lang: Lang = 'en',
): { milestones: Unslugged<Milestone>[]; report: DropReport } {
  const milestones: Unslugged<Milestone>[] = [];
  const reasons: Record<string, number> = {};

  for (const row of rows) {
    // Inclusion is gated on English fields regardless of `lang` (see Lang).
    const validated = validateEventRow<MilestoneCategory>(row, reasons);
    if (!validated) continue;
    if (row.sitelinks <= 0) {
      record(reasons, 'missing sitelinks (enrichment failed)');
      continue;
    }

    const description = resolveOptionalField(
      row.description,
      row.descriptionRu,
      lang,
    );
    const shared = {
      id: row.id,
      name: resolveField(validated.name, row.labelRu, lang),
      category: validated.category,
      regionTags: row.regionTags,
      fameScore: row.fameScore,
      tagline: resolveField(validated.tagline, row.taglineRu, lang),
      wikipediaUrl: validated.article,
      ...imageFields(row.id, row.image, row.imageAttribution),
      ...(description ? { description } : {}),
      ...(row.approximateDate ? { approximateDate: true as const } : {}),
    };

    if (row.endYear !== undefined) {
      milestones.push({
        ...shared,
        period: {
          start: yearMonth(validated.year, validated.month),
          end: yearMonth(row.endYear, row.endMonth),
        },
      });
    } else {
      // Wikidata's claim precision decides whether month is present
      // (fetch-milestones-enrichment.ts), as for Conflicts.
      milestones.push({
        ...shared,
        at: yearMonth(validated.year, validated.month),
      });
    }
  }

  return {
    milestones,
    report: { dropped: rows.length - milestones.length, reasons },
  };
}

// The Detail Level whose delta file an entity ships in: the first level whose
// floor its Fame Score reaches, else the loosest. See splitByDetailLevel.
export function detailLevelOf(
  fameScore: number,
  levelFloors: readonly [number, number, number, number],
): 1 | 2 | 3 | 4 {
  if (fameScore >= levelFloors[0]) return 1;
  if (fameScore >= levelFloors[1]) return 2;
  if (fameScore >= levelFloors[2]) return 3;
  return 4;
}

export interface DetailLevelDeltas<T> {
  detail1: T[];
  detail2: T[];
  detail3: T[];
  detail4: T[];
}

// Splits a built lane array into the 4 Detail Level delta files (CONTEXT.md's
// Detail Level, docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md),
// each holding only what is new versus the previous level. `levelFloors` is
// [level1..level4], highest floor first. Level 4's floor is never a partition
// boundary (it is only the client-side render floor): detail4 holds everything
// below level 3's floor with no lower bound, so the 4 deltas' union is the full
// built array. Separate from the build* functions so it is testable
// independently of any lane's build rules. Preserves `entries`' order within
// each delta.
export function splitByDetailLevel<T extends { fameScore: number }>(
  entries: T[],
  levelFloors: readonly [number, number, number, number],
): DetailLevelDeltas<T> {
  const detail1: T[] = [];
  const detail2: T[] = [];
  const detail3: T[] = [];
  const detail4: T[] = [];
  const deltas = [detail1, detail2, detail3, detail4];
  for (const entry of entries) {
    deltas[detailLevelOf(entry.fameScore, levelFloors) - 1]?.push(entry);
  }
  return { detail1, detail2, detail3, detail4 };
}
