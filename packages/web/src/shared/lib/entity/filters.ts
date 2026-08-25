import type { ConflictsMilestonesFilterValue } from '../../config';
import type { MilestoneCategory, OccupationDomain, Region } from '../../types';
import { MILESTONE_CATEGORY_TO_GROUP } from '../../types';

// Shared by all three lanes to gate entity density by the active Fame Tier
// (packages/web/docs/adr/0002-fame-tier-drives-zoom.md) — the data-pipeline
// already ships every entry down to the specialist floor, so this is the
// only filtering step; no re-ranking needed since each tier's threshold is
// just a `fameScore >=` cutoff on the same already-sorted-by-tier data.
export function filterByFameScore<T extends { fameScore: number }>(
  items: T[],
  minFameScore: number,
): T[] {
  return items.filter((item) => item.fameScore >= minFameScore);
}

// People-only Occupation Domain filter (sidebar's Occupation Domain pills
// doubling as a filter, grill-with-docs session 2026-08-12). Multi-select OR: an item
// matches if its domain is any of the selected ones. An empty selection
// means unfiltered, not "match nothing" — mirrors filterByFameScore's floor
// of 0 always passing everything.
export function filterByOccupationDomain<
  T extends { occupationDomain: OccupationDomain },
>(items: T[], selectedDomains: OccupationDomain[]): T[] {
  if (selectedDomains.length === 0) return items;
  return items.filter((item) =>
    selectedDomains.includes(item.occupationDomain),
  );
}

// Shared Region filter, one control across all three lanes (grill-with-docs
// session 2026-08-12), applied to the raw per-lane datasets (Person/
// ConflictEntry/Milestone) alongside filterByFameScore/
// filterByOccupationDomain above — not the mapped *Item render shapes,
// which nothing downstream needs region tags on. Takes a `regionsOf`
// accessor rather than requiring `regionTags: Region[]` directly on T so it
// stays shape-agnostic across the three lanes' entity types. Multi-select
// OR, empty selection means unfiltered. An item with no matching region
// tags at all never matches a non-empty selection, so it's excluded
// whenever any region filter is active — see CONTEXT.md's Region entry.
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

// The sidebar's "Conflicts & Milestones" section is one shared multi-select
// filter (revised 2026-08-12 to match Region/Occupation Domain's "one flat
// list, empty means unfiltered" convention — an earlier version split this
// into a separate Milestone Category Group filter and a differently-styled
// Conflicts toggle). `selectedValues` folds a UI-only 'conflicts' sentinel
// together with the 2 real MilestoneCategoryGroup values (see
// shared/config/conflicts-milestones-filter.ts) — these two functions each
// read the one shared array, keyed off whichever part of it applies to
// their own lane.

// Milestones-only: same 2-group level the Milestones lane's color already
// varies at (see MILESTONE_CATEGORY_TO_GROUP), not the 21-leaf-category
// level. A selected 'conflicts' sentinel is simply never equal to any
// MilestoneCategoryGroup, so it has no effect here.
export function filterByMilestoneCategoryGroup<
  T extends { category: MilestoneCategory },
>(items: T[], selectedValues: ConflictsMilestonesFilterValue[]): T[] {
  if (selectedValues.length === 0) return items;
  return items.filter((item) =>
    selectedValues.includes(MILESTONE_CATEGORY_TO_GROUP[item.category]),
  );
}

// Conflicts-only: Conflicts carry no color-driving grouping of their own
// (docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md), so
// this is an all-or-nothing gate keyed on whether the 'conflicts' sentinel
// is present in the shared selection, not a per-item predicate.
export function filterConflictsByFilterValues<T>(
  items: T[],
  selectedValues: ConflictsMilestonesFilterValue[],
): T[] {
  if (selectedValues.length === 0) return items;
  return selectedValues.includes('conflicts') ? items : [];
}
