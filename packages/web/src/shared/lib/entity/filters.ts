import type { ConflictsMilestonesFilterValue } from '../../config';
import type { MilestoneCategory, OccupationDomain, Region } from '../../types';
import { MILESTONE_CATEGORY_TO_GROUP } from '../../types';

// Shared by all three lanes: gates entity density by a `fameScore` floor
// (packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md).
export function filterByFameScore<T extends { fameScore: number }>(
  items: T[],
  minFameScore: number,
): T[] {
  return items.filter((item) => item.fameScore >= minFameScore);
}

// People-only Occupation Domain filter. Multi-select OR: an item matches if
// its domain is any selected one. An empty selection means unfiltered, not
// "match nothing".
export function filterByOccupationDomain<
  T extends { occupationDomain: OccupationDomain },
>(items: T[], selectedDomains: OccupationDomain[]): T[] {
  if (selectedDomains.length === 0) return items;
  return items.filter((item) =>
    selectedDomains.includes(item.occupationDomain),
  );
}

// Region filter shared by all three lanes, applied to the raw per-lane
// datasets rather than the mapped *Item render shapes. `regionsOf` keeps it
// agnostic to the lanes' entity types. Multi-select OR, empty selection
// means unfiltered; an item with no region tags is excluded whenever any
// region is selected (CONTEXT.md's Region).
export function filterByRegion<T>(
  items: T[],
  selectedRegions: Region[],
  regionsOf: (item: T) => Region[],
): T[] {
  if (selectedRegions.length === 0) return items;
  return items.filter((item) =>
    regionsOf(item).some((region) => selectedRegions.includes(region)),
  );
}

// The sidebar's "Conflicts & Milestones" section is one multi-select filter.
// `selectedValues` holds a UI-only 'conflicts' value plus the 2
// MilestoneCategoryGroup values (shared/config/conflicts-milestones-filter.ts);
// each function below reads the part that applies to its own lane.

// Milestones-only: filters at the group level (MILESTONE_CATEGORY_TO_GROUP),
// not the leaf categories. 'conflicts' never equals a group, so it has no
// effect here.
export function filterByMilestoneCategoryGroup<
  T extends { category: MilestoneCategory },
>(items: T[], selectedValues: ConflictsMilestonesFilterValue[]): T[] {
  if (selectedValues.length === 0) return items;
  return items.filter((item) =>
    selectedValues.includes(MILESTONE_CATEGORY_TO_GROUP[item.category]),
  );
}

// Conflicts-only: Conflicts have no grouping of their own
// (docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md), so
// this is an all-or-nothing gate on the 'conflicts' value, not a per-item
// predicate.
export function filterConflictsByFilterValues<T>(
  items: T[],
  selectedValues: ConflictsMilestonesFilterValue[],
): T[] {
  if (selectedValues.length === 0) return items;
  return selectedValues.includes('conflicts') ? items : [];
}

// Every filter that narrows what the lanes draw, as one value. The lane
// pipelines below are the single definition of "visible", shared by the canvas
// (what it draws), Search (what it offers) and the Selection (which members
// are hidden).
export interface ActiveFilters {
  fameScoreValues: { people: number; conflicts: number; milestones: number };
  selectedDomains: OccupationDomain[];
  selectedRegions: Region[];
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
}

export function visiblePeople<
  T extends {
    fameScore: number;
    occupationDomain: OccupationDomain;
    regionTags: Region[];
  },
>(people: T[], filters: ActiveFilters): T[] {
  return filterByRegion(
    filterByOccupationDomain(
      filterByFameScore(people, filters.fameScoreValues.people),
      filters.selectedDomains,
    ),
    filters.selectedRegions,
    (person) => person.regionTags,
  );
}

export function visibleConflicts<
  T extends { fameScore: number; regionTags: Region[] },
>(conflicts: T[], filters: ActiveFilters): T[] {
  return filterConflictsByFilterValues(
    filterByRegion(
      filterByFameScore(conflicts, filters.fameScoreValues.conflicts),
      filters.selectedRegions,
      (entry) => entry.regionTags,
    ),
    filters.selectedConflictsMilestonesValues,
  );
}

export function visibleMilestones<
  T extends {
    fameScore: number;
    regionTags: Region[];
    category: MilestoneCategory;
  },
>(milestones: T[], filters: ActiveFilters): T[] {
  return filterByMilestoneCategoryGroup(
    filterByRegion(
      filterByFameScore(milestones, filters.fameScoreValues.milestones),
      filters.selectedRegions,
      (milestone) => milestone.regionTags,
    ),
    filters.selectedConflictsMilestonesValues,
  );
}
