import type { Category, Region } from "@same-sky/shared-types";
import type { GroupedRow } from "./group-rows.js";
import { OCCUPATION_CATEGORIES } from "./occupation-categories.js";
import { REGION_CATEGORIES } from "./region-categories.js";

export interface PersonTags {
  category?: Category;
  occupationTags: Category[];
  regionTags: Region[];
}

// category is the first occupation claim (in claim order) that maps to a
// known category; occupationTags is the full deduped set, used for
// occupation-filter matching. regionTags is deduped and may legitimately be
// empty (no country claim at all, or a claim outside the app's 6 regions).
export function tagPerson(row: GroupedRow): PersonTags {
  const occupationTags: Category[] = [];
  let category: Category | undefined;

  for (const occupationId of row.tags) {
    const mapped = OCCUPATION_CATEGORIES[occupationId];
    if (!mapped) continue;
    if (category === undefined) category = mapped;
    if (!occupationTags.includes(mapped)) occupationTags.push(mapped);
  }

  const regionTags: Region[] = [];
  for (const countryId of row.countries) {
    const mapped = REGION_CATEGORIES[countryId];
    if (mapped && !regionTags.includes(mapped)) regionTags.push(mapped);
  }

  return { category, occupationTags, regionTags };
}
