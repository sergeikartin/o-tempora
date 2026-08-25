import { expect, test } from 'vitest';
import type { ConflictsMilestonesFilterValue } from '../../config';
import type { MilestoneCategory, Region } from '../../types';
import {
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
} from './filters';

// filterByFameScore — shared client-side Fame Tier gate for all three lanes.
test('filterByFameScore keeps only items whose fameScore clears the threshold', () => {
  const items = [
    { id: 'a', fameScore: 90 },
    { id: 'b', fameScore: 89 },
    { id: 'c', fameScore: 100 },
  ];
  expect(filterByFameScore(items, 90).map((item) => item.id)).toEqual([
    'a',
    'c',
  ]);
});

test('filterByFameScore keeps a value exactly at the threshold', () => {
  const items = [{ id: 'a', fameScore: 50 }];
  expect(filterByFameScore(items, 50)).toHaveLength(1);
});

// filterByOccupationDomain — People-only Legend-pill filter.
test('filterByOccupationDomain returns items unchanged when no domains are selected', () => {
  const items = [
    { id: 'a', occupationDomain: 'arts' as const },
    { id: 'b', occupationDomain: 'sports' as const },
  ];
  expect(filterByOccupationDomain(items, [])).toEqual(items);
});

test('filterByOccupationDomain keeps only items whose domain is selected', () => {
  const items = [
    { id: 'a', occupationDomain: 'arts' as const },
    { id: 'b', occupationDomain: 'sports' as const },
    { id: 'c', occupationDomain: 'humanities' as const },
  ];
  expect(
    filterByOccupationDomain(items, ['arts']).map((item) => item.id),
  ).toEqual(['a']);
});

test('filterByOccupationDomain unions multiple selected domains (OR)', () => {
  const items = [
    { id: 'a', occupationDomain: 'arts' as const },
    { id: 'b', occupationDomain: 'sports' as const },
    { id: 'c', occupationDomain: 'humanities' as const },
  ];
  expect(
    filterByOccupationDomain(items, ['arts', 'sports']).map((item) => item.id),
  ).toEqual(['a', 'b']);
});

// filterByRegion — one shared filter across all three lanes. Takes a
// regionsOf accessor rather than requiring `regionTags: Region[]` directly
// on the item type, so it stays shape-agnostic across the three lanes'
// entity types — these tests fix the accessor to a plain `regionTags` field.
interface RegionFixture {
  id: string;
  regionTags: Region[];
}
const regionsOf = (item: RegionFixture) => item.regionTags;

test('filterByRegion returns items unchanged when no regions are selected', () => {
  const items: RegionFixture[] = [
    { id: 'a', regionTags: ['western-europe'] },
    { id: 'b', regionTags: [] },
  ];
  expect(filterByRegion(items, [], regionsOf)).toEqual(items);
});

test('filterByRegion keeps only items tagged with a selected region', () => {
  const items: RegionFixture[] = [
    { id: 'a', regionTags: ['western-europe'] },
    { id: 'b', regionTags: ['northern-africa'] },
    { id: 'c', regionTags: [] },
  ];
  expect(
    filterByRegion(items, ['western-europe'], regionsOf).map((item) => item.id),
  ).toEqual(['a']);
});

test('filterByRegion unions multiple selected regions (OR) and matches any tag in a multi-tag item', () => {
  const items: RegionFixture[] = [
    { id: 'a', regionTags: ['western-europe', 'northern-africa'] },
    { id: 'b', regionTags: ['northern-america'] },
    { id: 'c', regionTags: ['southern-asia'] },
  ];
  expect(
    filterByRegion(
      items,
      ['northern-africa', 'northern-america'],
      regionsOf,
    ).map((item) => item.id),
  ).toEqual(['a', 'b']);
});

test('filterByRegion excludes an item with no region tags once a filter is active', () => {
  const items: RegionFixture[] = [{ id: 'a', regionTags: [] }];
  expect(filterByRegion(items, ['western-europe'], regionsOf)).toHaveLength(0);
});

// filterByMilestoneCategoryGroup / filterConflictsByFilterValues — the
// sidebar's "Conflicts & Milestones" section is one shared multi-select
// (ConflictsMilestonesFilterValue[]: 'conflicts' + the 2 MilestoneCategoryGroup
// values), applied differently per lane.
interface MilestoneGroupFixture {
  id: string;
  category: MilestoneCategory;
}

test('filterByMilestoneCategoryGroup returns items unchanged when no values are selected', () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' },
  ];
  expect(filterByMilestoneCategoryGroup(items, [])).toEqual(items);
});

test('filterByMilestoneCategoryGroup excludes items from a non-selected group', () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' }, // science-innovation
    { id: 'b', category: 'commerce-finance' }, // social-culture
  ];
  expect(
    filterByMilestoneCategoryGroup(items, ['science-innovation']).map(
      (item) => item.id,
    ),
  ).toEqual(['a']);
});

test('filterByMilestoneCategoryGroup unions multiple selected groups (OR)', () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' }, // science-innovation
    { id: 'b', category: 'commerce-finance' }, // social-culture
    { id: 'c', category: 'law-jurisprudence' }, // social-culture
  ];
  expect(
    filterByMilestoneCategoryGroup(items, [
      'science-innovation',
      'social-culture',
    ]).map((item) => item.id),
  ).toEqual(['a', 'b', 'c']);
});

test("filterByMilestoneCategoryGroup ignores a selected 'conflicts' sentinel — never matches a MilestoneCategoryGroup", () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' },
  ];
  const selectedValues: ConflictsMilestonesFilterValue[] = ['conflicts'];
  expect(filterByMilestoneCategoryGroup(items, selectedValues)).toEqual([]);
});

test('filterConflictsByFilterValues returns items unchanged when no values are selected', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  expect(filterConflictsByFilterValues(items, [])).toEqual(items);
});

test("filterConflictsByFilterValues keeps items when 'conflicts' is selected", () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const selectedValues: ConflictsMilestonesFilterValue[] = ['conflicts'];
  expect(filterConflictsByFilterValues(items, selectedValues)).toEqual(items);
});

test("filterConflictsByFilterValues excludes items when a non-empty selection omits 'conflicts'", () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const selectedValues: ConflictsMilestonesFilterValue[] = [
    'science-innovation',
  ];
  expect(filterConflictsByFilterValues(items, selectedValues)).toEqual([]);
});
