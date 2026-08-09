import type { ConflictCategory, DiscoveryCategory, Region } from "@same-sky/shared-types";
import { REGION_CATEGORIES } from "./region-categories.js";

export interface DiscoveryTags {
  category: DiscoveryCategory;
  regionTags: Region[];
}

export interface WarTags {
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

// Curated events (data/raw/events-curated.raw.json) are already hand-
// classified into DiscoveryCategory — no lookup table needed; category just
// passes through.
export function tagCuratedDiscovery(category: DiscoveryCategory, countries: string[]): DiscoveryTags {
  return { category, regionTags: regionTagsFor(countries) };
}

// Curated wars (data/raw/wars-curated.raw.json) are already hand-classified
// into ConflictCategory by the curator — same "no lookup table, category
// just passes through" reasoning as tagCuratedDiscovery above. Only
// regionTags is derived, from the countries Wikidata enrichment resolved.
export function tagCuratedWar(category: ConflictCategory, countries: string[]): WarTags {
  return { category, regionTags: regionTagsFor(countries) };
}
