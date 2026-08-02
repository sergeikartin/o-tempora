// Canonical Person/HistoricalEvent data contracts, shared between
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
export interface Person {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number;
  category: Category;
  occupationTags: Category[];
  regionTags: Region[];
  fameScore: number;
  description: string;
  wikipediaUrl: string;
}

// Covers both historical events (wars, treaties, ...) and inventions —
// both sources merge into one events.json with this same shape.
export interface HistoricalEvent {
  id: string;
  name: string;
  date: number;
  category: Category;
  regionTags: Region[];
  fameScore: number;
  description: string;
  wikipediaUrl: string;
}
