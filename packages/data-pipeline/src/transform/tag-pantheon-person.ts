import type { OccupationDomain, Region } from "@o-tempora/shared-types";
import type { PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { OCCUPATION_DOMAIN_CATEGORIES } from "./occupation-domain-categories.js";
import { UN_REGION_CATEGORIES } from "./un-region-categories.js";

export interface PantheonPersonTags {
  occupationDomain?: OccupationDomain;
  regionTags: Region[];
}

// occupationDomain is undefined for the 62 rows with no occupation claim,
// or the rare row whose occupation value somehow isn't one of the 101
// known ones (closed set today, but not guaranteed to stay that way on a
// future Pantheon release). regionTags is deduped across birth and death
// country and may legitimately be empty (unmapped territory, or no
// country claim at all).
export function tagPantheonPerson(row: PantheonPersonRow): PantheonPersonTags {
  const occupationDomain = row.occupation ? OCCUPATION_DOMAIN_CATEGORIES[row.occupation] : undefined;

  const regionTags: Region[] = [];
  for (const country of [row.bplaceCountry, row.dplaceCountry]) {
    if (!country) continue;
    const mapped = UN_REGION_CATEGORIES[country];
    if (mapped && !regionTags.includes(mapped)) regionTags.push(mapped);
  }

  return { occupationDomain, regionTags };
}
