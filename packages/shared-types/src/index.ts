// Canonical Person/War/Discovery data contracts, shared between
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

// Events & Inventions lane's own taxonomy, taken verbatim from the
// hand-curated source's `meta.categories`
// (data-pipeline/data/raw/events-curated.raw.json) — disjoint from
// ConflictCategory above (Wars & Conflicts' Wikidata-?type-claim-derived
// taxonomy), not a
// shared value even where a name happens to coincide (e.g. "exploration"
// appears in both, independently).
export const DISCOVERY_CATEGORIES = [
  "science-theory",
  "medicine-health",
  "communication",
  "transportation",
  "infrastructure",
  "everyday-technology",
  "food-agriculture",
  "exploration",
  "energy-industry",
  "society-administration",
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const REGIONS = [
  "europe",
  "east-asia",
  "south-asia",
  "middle-east",
  "africa",
  "americas",
] as const;

export type Region = (typeof REGIONS)[number];

// Pantheon's own occupation-domain grouping (its "Working in" filter),
// covering all 101 raw `occupation` values with no gaps — see
// data-pipeline/src/transform/occupation-domain-categories.ts for the mapping.
// Person-only: ConflictCategory/Region stay Wikidata-derived and War/Discovery-only
// (see the People-source decision this type follows from).
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

// The UN M49 geoscheme's 22 sub-regions — Person-only, keyed off Pantheon's
// present-day birth/death country rather than historical polity (unlike
// HistoricalEvent's Region, which is historical-polity-aware). See
// data-pipeline/src/transform/un-region-categories.ts for the country mapping.
export const UN_REGIONS = [
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

export type UnRegion = (typeof UN_REGIONS)[number];

// A calendar year plus optional month, astronomical/ISO numbering (year 0 is
// 1 BCE, year 1 is 1 CE — Invariant 4 in architecture.md), matching
// Temporal.PlainDate's own sign convention. `month` (1-12) is present only
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

// Shared by Person, War, WarEvent, and Discovery — every lane's entries
// carry these fields regardless of whether they render as a period or a
// point (see Period/PointInTime above for the date shapes themselves,
// which now live on each entity directly since not every entity has the
// same one).
export interface TimelineEntry {
  id: string;
  name: string;
  fameScore: number;
  description: string;
  wikipediaUrl: string;
  // The raw Wikidata P18 Commons `Special:FilePath` URI, stored exactly as
  // SPARQL returns it — no width baked in, same "store verbatim" convention
  // wikipediaUrl already uses. Absent means no P18 claim — true for all
  // four entity types now (People, Discoveries, and, since the Wars &
  // Conflicts taxonomy restructure, War/WarEvent too — see
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
}

// Sourced from Pantheon 2.0, not Wikidata — fameScore is Pantheon's own HPI
// (0-100), not a sitelink count (see ../data-pipeline/src/transform/score.ts's
// FAME_TIER_MIN_HPI, independent of War/Discovery's sitelink-based tiers).
export interface Person extends TimelineEntry {
  // Pantheon's `occupation` field is single-valued per person, unlike
  // Wikidata's potentially-multiple occupation claims — one domain, not an
  // array of tags.
  occupationDomain: OccupationDomain;
  // Birth region and death region can genuinely differ, so this stays an
  // array even though occupationDomain doesn't need to be.
  regionTags: UnRegion[];
  // Always a Period, never a point — a life is never a single moment.
  // `end` absent means still alive.
  lifespan: Period;
  // Best-effort: only populated when Wikidata has at least one qualified
  // P39 ("position held") statement with a start-time qualifier for this
  // person (see data-pipeline/src/fetch/queries/reigns.ts, keyed on the
  // Wikidata QID Pantheon retains per person). Most people have none.
  // Sorted ascending by start year; a person can have more than one (e.g. a
  // deposed-and-restored monarch, or multiple offices).
  reignPeriods?: ReignPeriod[];
}

// Shape is decoupled from category (data-pipeline's Wikidata enrichment
// pass decides it, not a fixed type-QID allowlist): a curated conflict
// becomes a War when its enrichment resolves both a start and an end date,
// a WarEvent (below) when it resolves only one. Any of the six
// ConflictCategory values can produce either shape depending on what
// Wikidata actually knows about that QID — see
// data-pipeline/src/output/write-datasets.ts's buildWars.
export interface War extends TimelineEntry {
  // Kept as the shared ConflictCategory type rather than a narrower literal
  // union so War and WarEvent can share CONFLICT_CATEGORY_COLORS and other
  // ConflictCategory-keyed lookups on the frontend.
  category: ConflictCategory;
  regionTags: Region[];
  period: Period;
  // Another curated row's id, always resolving to a War (never a WarEvent)
  // — a "Container" is simply a War with no parentId. Absent means this War
  // is either a Container itself or stands alone. Nesting is capped at 3
  // levels (Container → this row → a further WarEvent/War), enforced at
  // Output (write-datasets.ts's buildWars), not by this type.
  parentId?: string;
}

// A single-moment Wars & Conflicts entry. See War above for why these are
// a separate type from War (shape follows what Wikidata's enrichment
// resolves) rather than an optional end date on it.
export interface WarEvent extends TimelineEntry, PointInTime {
  category: ConflictCategory;
  regionTags: Region[];
  // Same contract as War.parentId above — always resolves to a War, never
  // another WarEvent (a WarEvent is always the deepest level, level 3).
  parentId?: string;
}

// The Wars & Conflicts lane's dataset (wars.json) is one array mixing both
// shapes — War and WarEvent are structurally disjoint (`period` vs `at`),
// so consumers narrow with `"period" in entry` rather than needing a
// separate `kind` discriminant field.
export type WarsAndConflictsEntry = War | WarEvent;

// Sourced from the hand-curated events list, not a Wikidata-?type-claim
// scan — category is curator-assigned directly (see tagCuratedDiscovery in
// data-pipeline/src/transform/tag-events.ts), hence its own DiscoveryCategory
// taxonomy rather than War's Category. Always a point in time, like a
// battle — an invention doesn't span a duration the way a life or a war
// does.
export interface Discovery extends TimelineEntry, PointInTime {
  category: DiscoveryCategory;
  regionTags: Region[];
}

// A single period a person held a qualified position (Wikidata P39 with
// P580/P582 start/end qualifiers) — monarchs, elected heads of
// state/government, and any other dated position, not just literal
// "king"/"queen" titles. Always a Period (extended directly, so `.start`/
// `.end` read the same as any other Period rather than nesting under a
// `.period` field) — `end` absent means Wikidata has no end-time claim
// (e.g. still holding the position, or the claim is simply incomplete),
// same "rendering-only fallback needed" situation as `Person.lifespan`'s
// open `end`, left for the frontend to decide how to fall back, not
// resolved here.
export interface ReignPeriod extends Period {
  // The position's own Wikidata label (e.g. "Pope", "King of England"),
  // not a generic "reign" placeholder — absent only when Wikidata has no
  // English label for the position itself (rare best-effort case).
  title?: string;
}
