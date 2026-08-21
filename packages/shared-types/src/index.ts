// Canonical Person/Conflict/Milestone data contracts, shared between
// /data-pipeline (which produces them) and /src (which will consume them
// from Unit 3/4 onward) via this workspace package rather than each project
// redefining them, per code-standards.md's "share those types" rule.

// Shrunk from nine values to six ([[Container/parentId nesting]] effort,
// see .scratch/wars-curated-source/spec.md) — battle, siege, and
// peace-treaty removed entirely, not deprecated/left unused. They're
// inherently sub-events of a war rather than standalone conflicts; every
// value that remains can stand alone as a top-level curated conflict.
export const CONFLICT_CATEGORIES = [
  "war",
  "military-operation",
  "revolution",
  "rebellion",
  "coup-d-etat",
  "war-of-independence",
] as const;

export type ConflictCategory = (typeof CONFLICT_CATEGORIES)[number];

// Milestones lane's own taxonomy, taken verbatim from the
// hand-curated source's `meta.categories`
// (data-pipeline/data/raw/milestones-curated.raw.json) — disjoint from
// ConflictCategory above (Conflicts' Wikidata-?type-claim-derived
// taxonomy), not a shared value even where names might coincide.
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

// The 2-value grouping above MilestoneCategory's 22 leaf values, driving
// the Milestones lane's color palette (packages/web's options.ts) and the
// sidebar's Milestone Category Group filter — the single canonical source
// both read from. See docs/design-tokens.md's Milestone Category Palette
// table for the current category -> group assignments, and
// docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md for
// the rationale behind the current split.
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

// The UN M49 geoscheme's 22 sub-regions — the single Region taxonomy for
// every lane (People, Conflicts, Milestones). Historical polities
// (Conflicts/Milestones) map to whatever sub-region their territory
// corresponds to today, not a successor state's name; People's tags key off
// Pantheon's present-day birth/death country instead. See
// data-pipeline/src/transform/region-categories.ts (Wikidata Q-ID keyed)
// and un-region-categories.ts (Pantheon country-name keyed) for the two
// source mappings.
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

// Pantheon's own occupation-domain grouping (its "Working in" filter),
// covering all 101 raw `occupation` values with no gaps — see
// data-pipeline/src/transform/occupation-domain-categories.ts for the mapping.
// Person-only: ConflictCategory stays Conflict/Milestone-only (see the
// People-source decision this type follows from).
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

// A calendar year plus optional month, astronomical/ISO numbering (year 0 is
// 1 BCE, year 1 is 1 CE — see docs/adr/0001-astronomical-year-numbering.md),
// matching Temporal.PlainDate's own sign convention. `month` (1-12) is present only
// when the source data's actual claim precision resolves to month-or-finer
// (e.g. Wikidata's wikibase:timePrecision >= 10) — never defaulted to
// January to paper over an unknown month, which would misrepresent
// precision Wikidata itself doesn't claim to have. The frontend adapter
// constructs a real Temporal.PlainYearMonth from this shape once month is
// known; year-only values stay plain numbers (see shared/lib/dates.ts).
export interface YearMonth {
  year: number;
  month?: number;
}

// A real duration with a known start and (usually) a known end — a
// person's lifespan, a war's span, a reign/term of office. `end` absent
// means genuinely ongoing/open-ended (a still-living person, a position
// with no recorded end date), not "unknown" in the sense of missing data —
// the frontend adapter renders these through to the present.
export interface Period {
  start: YearMonth;
  end?: YearMonth;
}

// A single moment — a battle, a treaty signing, an invention's first
// appearance. Distinct from Period (not "a Period with no end"): a point in
// time was never a duration to begin with.
export interface PointInTime {
  at: YearMonth;
}

// Payload Tier: the fame-score floor each lane's Output stage (data-pipeline)
// uses to split its shipped dataset file in two — CONTEXT.md's "Payload
// Tier", docs/adr/0004-payload-tier-split-defers-low-fame-data.md. Defined
// once here, shared by data-pipeline (which splits by it) and web (whose
// Data Depth "Mainstream" preset reuses the same numbers) so the two can
// never silently drift apart, even though they're conceptually independent —
// which tier an entry ships in never affects whether it renders.
export const TIER_0_FAME_SCORE_FLOOR = {
  people: 88,
  conflicts: 82,
  milestones: 82,
} as const;

// Shared by Person, Conflict, ConflictEvent, and Milestone — every lane's entries
// carry these fields regardless of whether they render as a period or a
// point (see Period/PointInTime above for the date shapes themselves,
// which now live on each entity directly since not every entity has the
// same one).
export interface TimelineEntry {
  id: string;
  name: string;
  fameScore: number;
  tagline: string;
  // Wikipedia's REST summary API's lead-paragraph `extract` for this
  // entity's English article — real prose, distinct from `tagline`'s short
  // Wikidata subtitle. Absent (not a fallback to `tagline`) whenever no
  // English Wikipedia article resolves; never causes the entity to be
  // dropped at publish (only a missing `tagline` does — see
  // write-datasets.ts). No length cap anywhere in the pipeline or the UI.
  description?: string;
  wikipediaUrl: string;
  // The raw Wikidata P18 Commons `Special:FilePath` URI, stored exactly as
  // SPARQL returns it — no width baked in, same "store verbatim" convention
  // wikipediaUrl already uses. Absent means no P18 claim — true for all
  // four entity types now (People, Milestones, and, since the Wars &
  // Conflicts taxonomy restructure, Conflict/ConflictEvent too — see
  // .scratch/wars-conflicts-taxonomy/map.md, which reverses the earlier
  // "Wars & Conflicts images are out of scope" call). The frontend appends
  // `?width=<n>` at render time, a plain string append onto this value.
  image?: string;
  // A plain display-ready credit string (e.g. "Jacques-Louis David, via
  // Wikimedia Commons"), populated only when the image's Commons license
  // requires attribution — absent both when there's no image and when the
  // image's license doesn't require a credit (the common, public-domain
  // case for this dataset's historical subjects).
  imageAttribution?: string;
  // Permanent per-item Row Depth identity (CONTEXT.md's Row Depth) —
  // data-pipeline computes this once, over the *entire* lane at Output time
  // (People among themselves; Conflicts and Milestones together, one shared
  // pass), so it never changes because of a client-side filter, zoom, or
  // Payload Tier's Tier 1 merge (docs/adr/0005-row-assignment-moves-to-the-
  // pipeline.md) — only a pipeline rebuild can move it. Optional in the type
  // purely so hand-built test fixtures that don't care about row-packing
  // don't need to supply one; real shipped data always sets it, and
  // packages/web's locale-datasets.ts validateEntries treats a missing/non-
  // finite row as schema drift, the same tripwire it already applies to a
  // missing id/name/date.
  row?: number;
}

// Sourced from Pantheon 2.0, not Wikidata — fameScore is Pantheon's own HPI
// (0-100), not a sitelink count (see ../data-pipeline/src/transform/score.ts's
// FAME_TIER_MIN_HPI, independent of Conflict/Milestone's sitelink-based tiers).
export interface Person extends TimelineEntry {
  // Pantheon's `occupation` field is single-valued per person, unlike
  // Wikidata's potentially-multiple occupation claims — one domain, not an
  // array of tags.
  occupationDomain: OccupationDomain;
  // Birth region and death region can genuinely differ, so this stays an
  // array even though occupationDomain doesn't need to be.
  regionTags: Region[];
  // Always a Period, never a point — a life is never a single moment.
  // `end` absent means still alive.
  lifespan: Period;
}

// Shape is decoupled from category (data-pipeline's Wikidata enrichment
// pass decides it, not a fixed type-QID allowlist): a curated conflict
// becomes a Conflict when its enrichment resolves both a start and an end
// date, a ConflictEvent (below) when it resolves only one. Any of the six
// ConflictCategory values can produce either shape depending on what
// Wikidata actually knows about that QID — see
// data-pipeline/src/output/write-datasets.ts's buildConflicts.
export interface Conflict extends TimelineEntry {
  // Kept as the shared ConflictCategory type rather than a narrower literal
  // union so Conflict and ConflictEvent can share CONFLICT_CATEGORY_COLORS
  // and other ConflictCategory-keyed lookups on the frontend.
  category: ConflictCategory;
  regionTags: Region[];
  period: Period;
  // Another curated row's id, always resolving to a Conflict (never a
  // ConflictEvent) — a "Container" is simply a Conflict with no parentId.
  // Absent means this Conflict is either a Container itself or stands
  // alone. Nesting is capped at 3 levels (Container → this row → a further
  // ConflictEvent/Conflict), enforced at Output (write-datasets.ts's
  // buildConflicts), not by this type.
  parentId?: string;
}

// A single-moment Conflicts entry. See Conflict above for why these are
// a separate type from Conflict (shape follows what Wikidata's enrichment
// resolves) rather than an optional end date on it.
export interface ConflictEvent extends TimelineEntry, PointInTime {
  category: ConflictCategory;
  regionTags: Region[];
  // Same contract as Conflict.parentId above — always resolves to a
  // Conflict, never another ConflictEvent (a ConflictEvent is always the
  // deepest level, level 3).
  parentId?: string;
}

// The Conflicts lane's dataset (conflicts.json) is one array mixing both
// shapes — Conflict and ConflictEvent are structurally disjoint (`period`
// vs `at`), so consumers narrow with `"period" in entry` rather than
// needing a separate `kind` discriminant field.
export type ConflictEntry = Conflict | ConflictEvent;

// Sourced from the hand-curated milestones list, not a Wikidata-?type-claim
// scan — category is curator-assigned directly (see tagCuratedMilestone in
// data-pipeline/src/transform/tag-milestones.ts), hence its own
// MilestoneCategory taxonomy rather than Conflict's Category. Date shape
// follows what Wikidata's enrichment resolves, the same rule
// Conflict/ConflictEvent already use: a period when both start (P580) and
// end (P582) resolve (e.g. the Black Death, 1346-1353), a point otherwise
// (e.g. an invention's first appearance) — see
// data-pipeline/src/output/write-datasets.ts's buildMilestones. Kept as one
// exported type (unlike Conflict/ConflictEvent's two names) since a
// period-shaped milestone isn't a different kind of thing, just a
// better-known date; narrow with `"period" in entry`, not a `kind`
// discriminant.
interface MilestonePeriod extends TimelineEntry {
  category: MilestoneCategory;
  regionTags: Region[];
  // Nested, like Conflict.period — not flattened the way MilestonePoint
  // flattens PointInTime's `at`, since `"period" in entry` (not `"at" in
  // entry`) is the narrowing check every consumer uses.
  period: Period;
}

interface MilestonePoint extends TimelineEntry, PointInTime {
  category: MilestoneCategory;
  regionTags: Region[];
}

export type Milestone = MilestonePeriod | MilestonePoint;

// Projects a YearMonth onto a single continuous number, e.g. for use as a
// position on a year-keyed x-scale — plain `year` when month is unknown
// (same as month 1, i.e. no offset), else `year` plus the fraction of the
// year elapsed by the start of that month. Shared verbatim by data-pipeline
// (TimelineEntry.row's one-time Output-stage packing) and packages/web
// (its own live, per-render pixel positioning) — see TimelineEntry.row.
export function yearMonthToFractionalYear(yearMonth: YearMonth): number {
  if (yearMonth.month === undefined) return yearMonth.year;
  return yearMonth.year + (yearMonth.month - 1) / 12;
}

// Label-sizing heuristic shared by data-pipeline (TimelineEntry.row's
// one-time Output-stage packing — a label's rendered width affects which
// items count as overlapping) and packages/web (the same estimate, reused
// for its own live pixel positioning) — a rough per-character estimate
// rather than a real DOM text-measurement pass, since data-pipeline has no
// DOM and the two need to agree on one answer regardless.
export const AVG_CHAR_WIDTH_PX = 6;
export const POINT_RADIUS = 5;
export const MILESTONES_LABEL_MAX_WIDTH_PX = 72;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

// Greedy word-wrap using the same rough per-character estimate as
// estimateLabelWidthPx — good enough to bound a label's rendered width
// without a real DOM text-measurement pass.
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
