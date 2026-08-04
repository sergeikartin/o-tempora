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

export interface Person extends TimelineEntry {
  category: Category;
  occupationTags: Category[];
  regionTags: Region[];
  // Best-effort: only populated when Wikidata has at least one qualified
  // P39 ("position held") statement with a start-time qualifier for this
  // person (see data-pipeline/fetch/queries/reigns.ts). Most people have
  // none. Sorted ascending by startYear; a person can have more than one
  // (e.g. a deposed-and-restored monarch, or multiple offices).
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
}
