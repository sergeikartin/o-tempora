// Person/Conflict/Milestone data contracts shared by data-pipeline (which
// produces them) and web (which consumes them), so neither redefines them.

// Six values, each able to stand alone as a top-level curated conflict
// (sub-events of a war such as battles, sieges and treaties are not
// categories). See .scratch/wars-curated-source/spec.md.
export const CONFLICT_CATEGORIES = [
  "war",
  "military-operation",
  "revolution",
  "rebellion",
  "coup-d-etat",
  "war-of-independence",
] as const;

export type ConflictCategory = (typeof CONFLICT_CATEGORIES)[number];

// Milestones lane's taxonomy, taken verbatim from the hand-curated source's
// `meta.categories` (data-pipeline/data/raw/milestones-curated.raw.json).
// Disjoint from ConflictCategory, even where names might coincide.
export const MILESTONE_CATEGORIES = [
  "science-theory",
  "medicine-health",
  "public-health",
  "communication",
  "media-culture",
  "transportation",
  "infrastructure",
  "landmarks",
  "everyday-technology",
  "food-agriculture",
  "expedition",
  "energy-industry",
  "society-administration",
  "culture-arts",
  "religion-mythology",
  "environment-geology",
  "commerce-finance",
  "social-movements",
  "sports-entertainment",
  "philosophy-education",
  "law-jurisprudence",
  "archaeology-anthropology",
] as const;

export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];

// The 2-value grouping above MilestoneCategory's 22 leaf values, driving the
// Milestones lane's color (packages/web's options.ts) and the sidebar's
// Conflicts & Milestones filter; the one source both read. See
// docs/design-tokens.md's Milestone Category Palette for the assignments and
// docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md for the
// rationale.
export const MILESTONE_CATEGORY_GROUPS = ["science-innovation", "social-culture"] as const;

export type MilestoneCategoryGroup = (typeof MILESTONE_CATEGORY_GROUPS)[number];

export const MILESTONE_CATEGORY_TO_GROUP: Record<MilestoneCategory, MilestoneCategoryGroup> = {
  "science-theory": "science-innovation",
  "medicine-health": "science-innovation",
  communication: "science-innovation",
  transportation: "science-innovation",
  "everyday-technology": "science-innovation",
  "food-agriculture": "science-innovation",
  "energy-industry": "science-innovation",

  "public-health": "social-culture",
  "media-culture": "social-culture",
  landmarks: "social-culture",
  infrastructure: "social-culture",
  expedition: "social-culture",
  "society-administration": "social-culture",
  "culture-arts": "social-culture",
  "religion-mythology": "social-culture",
  "environment-geology": "social-culture",
  "commerce-finance": "social-culture",
  "social-movements": "social-culture",
  "sports-entertainment": "social-culture",
  "philosophy-education": "social-culture",
  "law-jurisprudence": "social-culture",
  "archaeology-anthropology": "social-culture",
};

// The UN M49 geoscheme's 22 sub-regions, the one Region taxonomy for every
// lane. Historical polities (Conflicts/Milestones) map to the sub-region their
// territory is in today; People's tags key off Pantheon's present-day
// birth/death country. See data-pipeline/src/transform/region-categories.ts
// (Wikidata Q-ID keyed) and un-region-categories.ts (Pantheon country-name
// keyed).
export const REGIONS = [
  "northern-europe",
  "southern-europe",
  "eastern-europe",
  "western-europe",
  "eastern-asia",
  "south-eastern-asia",
  "southern-asia",
  "central-asia",
  "western-asia",
  "northern-africa",
  "western-africa",
  "middle-africa",
  "eastern-africa",
  "southern-africa",
  "northern-america",
  "central-america",
  "caribbean",
  "south-america",
  "australia-and-new-zealand",
  "melanesia",
  "micronesia",
  "polynesia",
] as const;

export type Region = (typeof REGIONS)[number];

// Pantheon's occupation-domain grouping (its "Working in" filter), covering
// all 101 raw `occupation` values; see
// data-pipeline/src/transform/occupation-domain-categories.ts. Person-only.
export const OCCUPATION_DOMAINS = [
  "sports",
  "institutions",
  "arts",
  "humanities",
  "science-technology",
  "business-law",
  "public-figure",
  "exploration",
] as const;

export type OccupationDomain = (typeof OCCUPATION_DOMAINS)[number];

// A calendar year plus optional month in astronomical numbering (year 0 is
// 1 BCE, year 1 is 1 CE; docs/adr/0001-astronomical-year-numbering.md).
// `month` (1-12) is present only when the source claim's precision is
// month-or-finer (e.g. Wikidata's wikibase:timePrecision >= 10), never
// defaulted to January, which would claim precision Wikidata doesn't. The
// frontend formats it as text, not a date object
// (packages/web/src/shared/lib/date/format-year.ts's formatYearMonth).
export interface YearMonth {
  year: number;
  month?: number;
}

// A real duration with a known start and usually a known end: a lifespan, a
// war's span. `end` absent means genuinely ongoing (a living person), not
// missing data; the frontend renders it through to the present.
export interface Period {
  start: YearMonth;
  end?: YearMonth;
}

// A single moment (an invention's first appearance, a treaty signing). Not "a
// Period with no end": it was never a duration.
export interface PointInTime {
  at: YearMonth;
}

// Detail Level: the 4 per-lane Fame Score floors that decide both which
// entities render (web) and which delta file they ship in (data-pipeline's
// Output stage writes `<lane>.detail1.json` .. `.detail4.json`; CONTEXT.md's
// Detail Level, docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md).
// Index 0 is level 1 (Legendary, strictest floor), index 3 is level 4 (Deep
// Cut, loosest). Floors step by a constant per-lane multiplicative factor on
// entity count, not fame-score points. Defined once so the pipeline's split and
// web's switch can't drift apart.
export const DETAIL_LEVEL_FAME_SCORE_FLOORS = {
  people: [91, 88, 84, 80],
  conflicts: [86, 82, 78, 64],
  milestones: [87, 82, 76, 55],
} as const;

// Shared by Person, Conflict, ConflictEvent and Milestone, whether the entry
// renders as a period or a point (the date shapes live on each entity, since
// not every entity has the same one).
export interface TimelineEntry {
  id: string;
  // The readable identifier an Entity Link carries (`?e=<slug>`, CONTEXT.md).
  // Lowercase ASCII derived from the English name, so it is the same in both
  // locales, and unique across all three lanes. Never changes with the
  // entity's displayed name or locale.
  slug: string;
  name: string;
  fameScore: number;
  tagline: string;
  // Wikipedia's REST summary API lead-paragraph `extract` for this entity's
  // article in the dataset's language (en/ru): prose, distinct from `tagline`'s
  // short Wikidata subtitle. Absent (not a `tagline` fallback) when no article
  // resolves; never drops the entity (only a missing `tagline` does; see
  // write-datasets.ts). No length cap in the pipeline or the UI.
  description?: string;
  wikipediaUrl: string;
  // The raw Wikidata P18 Commons `Special:FilePath` URI, stored verbatim with no
  // width baked in (like wikipediaUrl). Absent means no P18 claim, for all four
  // entity types. The frontend appends `?width=<n>` at render time.
  image?: string;
  // A display-ready credit string (e.g. "Jacques-Louis David, via Wikimedia
  // Commons"), set only when the image's Commons license requires attribution;
  // absent with no image or a license needing no credit (the common
  // public-domain case here).
  imageAttribution?: string;
  // Permanent per-item row (CONTEXT.md's Row Depth). data-pipeline computes it
  // once over the entire lane at Output (People among themselves; Conflicts and
  // Milestones in one shared pass), so client filters, zoom and deeper Detail
  // Level delta files never change it (docs/adr/0005-row-assignment-moves-to-the-pipeline.md);
  // only a pipeline rebuild can. Optional in the type only so test fixtures
  // needn't supply one; shipped data always sets it, and packages/web's
  // locale-datasets.ts validateEntries treats a missing or non-finite row as
  // schema drift.
  row?: number;
  // Set by Output on every entity that has a shipped Profile, in both language
  // files, so the panel never probes for `profiles/<locale>/<slug>.json`.
  // Absent, never `false`, when there is none.
  hasProfile?: true;
}

// A Key Moment's and Deep Fact's text carries `**bold**` runs; Output rejects
// any other markup, so the panel renders it as elements, never as HTML.
export interface ProfileKeyMoment {
  date: string;
  title: string;
  text: string;
}

export interface ProfileDeepFact {
  text: string;
  isLegend: boolean;
}

export const PROFILE_LANES = ["people", "conflicts", "milestones"] as const;

export type ProfileLane = (typeof PROFILE_LANES)[number];

// A Connection (CONTEXT.md) already resolved against the dataset by Output, so
// the panel needs no matching. `detailLevel` is the lowest Detail Level that
// shows the target (1 = Legendary .. 4 = Deep Cut).
export interface ProfileConnection {
  slug: string;
  reason: string;
  name: string;
  lane: ProfileLane;
  detailLevel: 1 | 2 | 3 | 4;
}

// The shipped Profile (CONTEXT.md): one file per entity per locale at
// `profiles/<locale>/<slug>.json`. Connections are in the model's importance
// order.
export interface Profile {
  overview: string;
  keyMoments: readonly ProfileKeyMoment[];
  deepFacts: readonly ProfileDeepFact[];
  connections: readonly ProfileConnection[];
}

// Sourced from Pantheon 2.0, not Wikidata: fameScore is Pantheon's HPI (0-100)
// (see ../data-pipeline/src/transform/score.ts's FAME_TIER_MIN_HPI), separate
// from Conflicts/Milestones' blended score.
export interface Person extends TimelineEntry {
  // Pantheon's `occupation` is single-valued per person (Wikidata's can be
  // multiple): one domain, not an array.
  occupationDomain: OccupationDomain;
  // Birth and death regions can differ, so this is an array even though
  // occupationDomain isn't.
  regionTags: Region[];
  // Always a Period, never a point — a life is never a single moment.
  // `end` absent means still alive.
  lifespan: Period;
}

// Shape is decoupled from category (data-pipeline's Wikidata enrichment
// decides it): a curated conflict is a Conflict when enrichment resolves both
// a start and an end date, a ConflictEvent (below) when only one. Any of the
// six ConflictCategory values can produce either; see
// data-pipeline/src/output/write-datasets.ts's buildConflicts.
export interface Conflict extends TimelineEntry {
  // The shared ConflictCategory type (not a narrower union) so Conflict and
  // ConflictEvent can share ConflictCategory-keyed lookups.
  category: ConflictCategory;
  regionTags: Region[];
  period: Period;
  // Another curated row's id, always a Conflict (never a ConflictEvent); a
  // "Container" is a Conflict with no parentId. Absent means a Container or a
  // standalone Conflict. Nesting is capped at 3 levels (Container → this row →
  // a further ConflictEvent/Conflict), enforced at Output (write-datasets.ts's
  // buildConflicts), not by this type.
  parentId?: string;
}

// A single-moment Conflicts entry; a separate type from Conflict because shape
// follows what Wikidata's enrichment resolves (see Conflict above).
export interface ConflictEvent extends TimelineEntry, PointInTime {
  category: ConflictCategory;
  regionTags: Region[];
  // Same contract as Conflict.parentId, and a ConflictEvent is always the
  // deepest level (3).
  parentId?: string;
}

// A Conflicts dataset is one array mixing both shapes. Conflict and
// ConflictEvent are structurally disjoint (`period` vs `at`), so consumers
// narrow with `"period" in entry`, with no `kind` discriminant.
export type ConflictEntry = Conflict | ConflictEvent;

// Sourced from the hand-curated milestones list; the category is
// curator-assigned (data-pipeline/src/transform/tag-milestones.ts's
// tagCuratedMilestone), hence its own MilestoneCategory taxonomy. Date shape
// follows enrichment, as for Conflict/ConflictEvent: a period when both start
// (P580) and end (P582) resolve (e.g. the Black Death, 1346-1353), a point
// otherwise (see data-pipeline/src/output/write-datasets.ts's buildMilestones).
// One exported type, since a period-shaped milestone is the same kind of thing
// with a better-known date; narrow with `"period" in entry`.
interface MilestonePeriod extends TimelineEntry {
  category: MilestoneCategory;
  regionTags: Region[];
  approximateDate?: true;
  // Nested like Conflict.period, not flattened like MilestonePoint's `at`, since
  // `"period" in entry` is the narrowing check every consumer uses.
  period: Period;
}

interface MilestonePoint extends TimelineEntry, PointInTime {
  category: MilestoneCategory;
  regionTags: Region[];
  // The date is a scholarly estimate rather than a recorded one; the UI
  // prefixes it with "ca.".
  approximateDate?: true;
}

export type Milestone = MilestonePeriod | MilestonePoint;

// Projects a YearMonth onto one continuous number for a year-keyed x-scale:
// `year` when month is unknown (same as month 1), else `year` plus the
// fraction of the year elapsed by that month's start. Shared by data-pipeline's
// one-time row packing and web's live positioning (see TimelineEntry.row).
export function yearMonthToFractionalYear(yearMonth: YearMonth): number {
  if (yearMonth.month === undefined) return yearMonth.year;
  return yearMonth.year + (yearMonth.month - 1) / 12;
}

// Label-sizing heuristic shared by data-pipeline (one-time row packing, where
// label width affects which items overlap) and web (live positioning): a rough
// per-character estimate, since data-pipeline has no DOM and both need one
// answer.
export const AVG_CHAR_WIDTH_PX = 6;
export const POINT_RADIUS = 5;
// A point mark's label starts this far right of its dot's center — clear of
// the selection ring web draws around a selected dot.
export const POINT_LABEL_OFFSET_PX = 13;
// A period or point label wraps onto at most two lines once it outgrows
// this width.
export const MARK_LABEL_WRAP_WIDTH_PX = 140;
export const MARK_LABEL_MAX_LINES = 2;

// CONTEXT.md's Reference Scale: the fixed pixels-per-year data-pipeline packs
// TimelineEntry.row against (row-assignment.ts) and web packs the Minimap's
// Row Depth curve against (Minimap.tsx); both must agree for the Minimap's
// depth to match the shipped `row`. Equal to web's default 120-year opening
// view at its 1000px fallback viewport width
// (FALLBACK_VIEWPORT_WIDTH_PX / DEFAULT_VISIBLE_YEARS); web's options.test.ts
// asserts the derivation matches this constant.
export const REFERENCE_SCALE_PIXELS_PER_YEAR = 1000 / 120;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

// Greedy word-wrap using the estimateLabelWidthPx estimate, bounding a label's
// width without DOM measurement.
export function wrapLabelLines(name: string, maxWidthPx: number): string[] {
  const words = name.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine !== '' && estimateLabelWidthPx(candidate) > maxWidthPx) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  return lines;
}

export function wrapMarkLabelLines(name: string): string[] {
  const lines = wrapLabelLines(name, MARK_LABEL_WRAP_WIDTH_PX);
  if (lines.length <= MARK_LABEL_MAX_LINES) return lines;
  return [
    ...lines.slice(0, MARK_LABEL_MAX_LINES - 1),
    lines.slice(MARK_LABEL_MAX_LINES - 1).join(' '),
  ];
}
