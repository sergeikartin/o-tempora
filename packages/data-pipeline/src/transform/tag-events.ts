import type { ConflictCategory, DiscoveryCategory, Region } from "@same-sky/shared-types";
import type { GroupedRow } from "./group-rows.js";
import { EVENT_TYPE_CATEGORIES } from "./event-type-categories.js";
import { REGION_CATEGORIES } from "./region-categories.js";

export interface EventTags {
  category?: ConflictCategory;
  regionTags: Region[];
}

export interface DiscoveryTags {
  category: DiscoveryCategory;
  regionTags: Region[];
}

function regionTagsFor(countries: string[]): Region[] {
  const regionTags: Region[] = [];
  for (const countryId of countries) {
    const mapped = REGION_CATEGORIES[countryId];
    if (mapped && !regionTags.includes(mapped)) regionTags.push(mapped);
  }
  return regionTags;
}

// Historical events carry a ?type claim mapped via the closed 9-class
// EVENT_TYPE_CATEGORIES table — a direct 1:1 Q-ID -> ConflictCategory map,
// not a collapsing lookup. Each row's `tags` is a singleton by construction
// (fetch/queries/historical-events.ts's per-category BIND), so this loop
// only ever runs one iteration in practice; a row spanning more than one
// category (a Wikidata item with multiple instance-of claims matching more
// than one of the 9 category queries) is resolved upstream instead, by
// transform/index.ts's dedupeFirstById, before it ever reaches this
// function.
export function tagHistoricalEvent(row: GroupedRow): EventTags {
  let category: ConflictCategory | undefined;
  for (const typeId of row.tags) {
    const mapped = EVENT_TYPE_CATEGORIES[typeId];
    if (mapped) {
      category = mapped;
      break;
    }
  }
  return { category, regionTags: regionTagsFor(row.countries) };
}

// Curated events (data/raw/events-curated.raw.json) are already hand-
// classified into DiscoveryCategory — no lookup table needed, unlike
// tagHistoricalEvent's ?type-claim mapping; category just passes through.
export function tagCuratedDiscovery(category: DiscoveryCategory, countries: string[]): DiscoveryTags {
  return { category, regionTags: regionTagsFor(countries) };
}
