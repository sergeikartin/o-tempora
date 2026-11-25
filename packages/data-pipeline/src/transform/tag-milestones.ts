import type {
  ConflictCategory,
  MilestoneCategory,
  Region,
} from '@o-tempora/shared-types';
import { REGION_CATEGORIES } from './region-categories.ts';

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

export function tagCuratedMilestone(
  category: MilestoneCategory,
  countries: string[],
): MilestoneTags {
  return { category, regionTags: regionTagsFor(countries) };
}

export function tagCuratedConflict(
  category: ConflictCategory,
  countries: string[],
): ConflictTags {
  return { category, regionTags: regionTagsFor(countries) };
}
