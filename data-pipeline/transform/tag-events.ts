import type { Category, Region } from "@same-sky/shared-types";
import type { GroupedRow } from "./group-rows.js";
import { EVENT_TYPE_CATEGORIES } from "./event-type-categories.js";
import { REGION_CATEGORIES } from "./region-categories.js";

export interface EventTags {
  category?: Category;
  regionTags: Region[];
}

function regionTagsFor(row: GroupedRow): Region[] {
  const regionTags: Region[] = [];
  for (const countryId of row.countries) {
    const mapped = REGION_CATEGORIES[countryId];
    if (mapped && !regionTags.includes(mapped)) regionTags.push(mapped);
  }
  return regionTags;
}

// Historical events carry a ?type claim mapped via the closed 8-class
// EVENT_TYPE_CATEGORIES table (first claim, in claim order, that maps).
export function tagHistoricalEvent(row: GroupedRow): EventTags {
  let category: Category | undefined;
  for (const typeId of row.tags) {
    const mapped = EVENT_TYPE_CATEGORIES[typeId];
    if (mapped) {
      category = mapped;
      break;
    }
  }
  return { category, regionTags: regionTagsFor(row) };
}

// Inventions have no ?type field to key off (see fetch/queries/inventions.ts)
// — every row gets "invention" unconditionally, no lookup table needed.
export function tagInvention(row: GroupedRow): EventTags {
  return { category: "invention", regionTags: regionTagsFor(row) };
}
