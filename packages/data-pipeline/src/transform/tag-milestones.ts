import type { ConflictCategory, MilestoneCategory, Region } from "@o-tempora/shared-types";
import { REGION_CATEGORIES } from "./region-categories.js";

export interface MilestoneTags {
  category: MilestoneCategory;
  regionTags: Region[];
}

export interface ConflictTags {
  category: ConflictCategory;
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

// Curated milestones (data/raw/milestones-curated.raw.json) are already hand-
// classified into MilestoneCategory — no lookup table needed; category just
// passes through.
export function tagCuratedMilestone(category: MilestoneCategory, countries: string[]): MilestoneTags {
  return { category, regionTags: regionTagsFor(countries) };
}

// Curated conflicts (data/raw/conflicts-curated.raw.json) are already hand-classified
// into ConflictCategory by the curator — same "no lookup table, category
// just passes through" reasoning as tagCuratedMilestone above. Only
// regionTags is derived, from the countries Wikidata enrichment resolved.
export function tagCuratedConflict(category: ConflictCategory, countries: string[]): ConflictTags {
  return { category, regionTags: regionTagsFor(countries) };
}
