// Canonical Person/War/Discovery data contracts, shared between
// /data-pipeline (which produces them) and /src (which will consume them
// from Unit 3/4 onward) via this workspace package rather than each project
// redefining them, per code-standards.md's "share those types" rule.

export const CATEGORIES = [
  "science",
  "politics",
  "art",
  "philosophy",
  "war",
  "invention",
  "exploration",
  "religion",
] as const;

export type Category = (typeof CATEGORIES)[number];

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
// data-pipeline/transform/occupation-domain-categories.ts for the mapping.
// Person-only: Category/Region stay Wikidata-derived and War/Discovery-only
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
// data-pipeline/transform/un-region-categories.ts for the country mapping.
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

// Year fields are plain integers, not Temporal.PlainDate instances or ISO
// date strings: source data is frequently only certain to the year, and the
// app's own zoom bound (10-year minimum window) never needs finer precision.
// BCE years are negative, matching Temporal.PlainDate's ISO calendar
// convention end-to-end (Invariant 4 in architecture.md) — the frontend
// adapter constructs Temporal.PlainDate(year, 1, 1) from this integer.
//
// Shared by Person, War, and Discovery — every lane renders on the same
// timeline off this same start/end shape, whether it's a person's
// lifespan, a war's duration, or a single-year discovery (endYear absent).
export interface TimelineEntry {
  id: string;
  name: string;
  startYear: number;
  endYear?: number;
  fameScore: number;
  description: string;
  wikipediaUrl: string;
}

// Sourced from Pantheon 2.0, not Wikidata — fameScore is Pantheon's own HPI
// (0-100), not a sitelink count (see transform/score.ts's
// FAME_TIER_MIN_HPI, independent of War/Discovery's sitelink-based tiers).
export interface Person extends TimelineEntry {
  // Pantheon's `occupation` field is single-valued per person, unlike
  // Wikidata's potentially-multiple occupation claims — one domain, not an
  // array of tags.
  occupationDomain: OccupationDomain;
  // Birth region and death region can genuinely differ, so this stays an
  // array even though occupationDomain doesn't need to be.
  regionTags: UnRegion[];
  // Best-effort: only populated when Wikidata has at least one qualified
  // P39 ("position held") statement with a start-time qualifier for this
  // person (see data-pipeline/fetch/queries/reigns.ts, keyed on the
  // Wikidata QID Pantheon retains per person). Most people have none.
  // Sorted ascending by startYear; a person can have more than one (e.g. a
  // deposed-and-restored monarch, or multiple offices).
  reignPeriods?: ReignPeriod[];
}

export interface War extends TimelineEntry {
  // "war" vs "politics" — a treaty or revolution is Wars & Conflicts-lane
  // but not literally a war; see EVENT_TYPE_CATEGORIES in data-pipeline.
  category: Category;
  regionTags: Region[];
  // Only ever populated for entities Wikidata classes as a war (wd:Q198,
  // the WAR_TYPE_QID in data-pipeline/transform/event-type-categories.ts)
  // that also carry a known end-time claim — battles, treaties, sieges,
  // etc. stay single-date points even when Wikidata happens to record a
  // duration for them, per the product decision that only wars render as
  // range bars. Absence does not mean "not a war," just "no known end
  // date" or "not a war" — consumers should not infer either from it
  // alone; use `category`/context instead.
  endYear?: number;
  // Human-readable name of the parent conflict this event is Wikidata
  // "part of" (P361) linked to, e.g. a battle -> its war. Best-effort:
  // present only when Wikidata has that link and an English label for the
  // target; the parent conflict itself may or may not also appear as its
  // own entry in this dataset.
  partOfWarName?: string;
}

// Category stays a real field, not hardcoded to "invention" — this lane
// covers both discoveries (e.g. "exploration") and inventions, even though
// the current Fetch-stage tagging only ever produces "invention" today
// (see tagInvention in data-pipeline/transform/tag-events.ts).
export interface Discovery extends TimelineEntry {
  category: Category;
  regionTags: Region[];
}

// A single period a person held a qualified position (Wikidata P39 with
// P580/P582 start/end qualifiers) — monarchs, elected heads of
// state/government, and any other dated position, not just literal
// "king"/"queen" titles. `endYear` absent means Wikidata has no end-time
// claim (e.g. still holding the position, or the claim is simply
// incomplete) — same "rendering-only stand-in needed" situation as
// `Person.endYear`, left for the frontend to decide how to fall back,
// not resolved here.
export interface ReignPeriod {
  startYear: number;
  endYear?: number;
  // The position's own Wikidata label (e.g. "Pope", "King of England"),
  // not a generic "reign" placeholder — absent only when Wikidata has no
  // English label for the position itself (rare; same best-effort stance
  // as War.partOfWarName).
  title?: string;
}
