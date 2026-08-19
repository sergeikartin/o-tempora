import { test, expect } from 'vitest';
import {
  assignRows,
  compactRows,
  computeRowAssignment,
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
  mapMilestones,
  mapPeople,
  mapConflicts,
} from './map-to-items';
import { today } from '../../shared/lib/dates';
import type { Milestone, MilestoneCategory, Person, Conflict, ConflictEvent, Region } from '../../shared/types';
import type { ConflictsMilestonesFilterValue } from '../../shared/config';

const person: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const personWithoutDeathYear: Person = {
  ...person,
  id: 'Q40939',
  name: 'Hesiod',
  lifespan: { start: { year: -750 }, end: undefined },
};

test('mapPeople maps a person with both years to an item with matching start/end', () => {
  const [item] = mapPeople([person]);
  expect(item?.id).toBe(person.id);
  expect(item?.name).toBe('Aristotle');
  expect(item?.startYear).toBe(-383);
  expect(item?.endYear).toBe(-321);
  expect(item?.occupationDomain).toBe('humanities');
  expect(item?.fameScore).toBe(317);
});

test('mapPeople falls back to today when lifespan.end is missing — still alive, not a collapsed bar', () => {
  const [item] = mapPeople([personWithoutDeathYear]);
  expect(item?.endYear).toBe(today().year);
});

const personWithMonths: Person = {
  ...person,
  id: 'Q1000',
  name: 'Someone',
  lifespan: { start: { year: 1900, month: 7 }, end: { year: 1980, month: 1 } },
};

test('mapPeople offsets startYear/endYear within their year when lifespan dates carry a month', () => {
  const [item] = mapPeople([personWithMonths]);
  expect(item?.startYear).toBeCloseTo(1900 + 6 / 12);
  expect(item?.endYear).toBe(1980);
});

const conflictWithEndYear: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['eastern-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const conflictZeroWidth: Conflict = {
  ...conflictWithEndYear,
  id: 'Q166376',
  name: 'Six-Day War',
  period: { start: { year: 1967 }, end: { year: 1967 } },
};

const battle: ConflictEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['northern-america'],
  fameScore: 250,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

test('mapConflicts maps a Conflict to a range item (isPoint: false)', () => {
  const [item] = mapConflicts([conflictWithEndYear]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1950);
  expect(item?.endYear).toBe(1953);
  expect(item?.category).toBe('war');
  expect(item?.fameScore).toBe(350);
});

test('mapConflicts widens a zero-width conflict range (start === end) by one year', () => {
  const [item] = mapConflicts([conflictZeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1967);
  expect(item?.endYear).toBe(1968);
});

test('mapConflicts maps a ConflictEvent to a point item', () => {
  const [item] = mapConflicts([battle]);
  expect(item?.isPoint).toBe(true);
  expect(item?.startYear).toBe(-1457);
  expect(item?.endYear).toBe(-1457);
});

const conflictWithMonths: Conflict = {
  ...conflictWithEndYear,
  id: 'Q9000',
  name: 'Conflict with known months',
  period: { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } },
};

test('mapConflicts offsets startYear/endYear within their year when period dates carry a month', () => {
  const [item] = mapConflicts([conflictWithMonths]);
  expect(item?.startYear).toBeCloseTo(1950 + 5 / 12);
  expect(item?.endYear).toBeCloseTo(1953 + 6 / 12);
});

const battleWithMonth: ConflictEvent = {
  ...battle,
  id: 'Q9001',
  name: 'Battle with known month',
  at: { year: 1457, month: 4 },
};

test('mapConflicts offsets a ConflictEvent point within its year when at carries a month', () => {
  const [item] = mapConflicts([battleWithMonth]);
  expect(item?.startYear).toBeCloseTo(1457 + 3 / 12);
  expect(item?.endYear).toBe(item?.startYear);
});

const milestone: Milestone = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['western-europe'],
  fameScore: 386,
  tagline: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

test('mapMilestones maps a milestone to a point item at its at.year', () => {
  const [item] = mapMilestones([milestone]);
  expect(item?.id).toBe(milestone.id);
  expect(item?.name).toBe('Printing press');
  expect(item?.startYear).toBe(1440);
  expect(item?.category).toBe('communication');
  expect(item?.fameScore).toBe(386);
});

const milestoneWithMonth: Milestone = {
  ...milestone,
  id: 'Q9002',
  name: 'Milestone with known month',
  at: { year: 1440, month: 10 },
};

test('mapMilestones offsets startYear within its year when at carries a month', () => {
  const [item] = mapMilestones([milestoneWithMonth]);
  expect(item?.startYear).toBeCloseTo(1440 + 9 / 12);
});

const blackDeath: Milestone = {
  id: 'Q42005',
  name: 'Black Death',
  period: { start: { year: 1346 }, end: { year: 1353 } },
  category: 'medicine-health',
  regionTags: ['western-europe'],
  fameScore: 84,
  tagline: '1346-1353 pandemic in Eurasia and North Africa',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Black_Death',
};

test('mapMilestones maps a period-shaped milestone to a range item (isPoint: false)', () => {
  const [item] = mapMilestones([blackDeath]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1346);
  expect(item?.endYear).toBe(1353);
});

test('mapMilestones widens a zero-width milestone range (start === end) by one year', () => {
  const zeroWidth: Milestone = { ...blackDeath, id: 'Q9003', period: { start: { year: 1346 }, end: { year: 1346 } } };
  const [item] = mapMilestones([zeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1346);
  expect(item?.endYear).toBe(1347);
});

// filterByFameScore — shared client-side Fame Tier gate for all three lanes.
test('filterByFameScore keeps only items whose fameScore clears the threshold', () => {
  const items = [{ id: 'a', fameScore: 90 }, { id: 'b', fameScore: 89 }, { id: 'c', fameScore: 100 }];
  expect(filterByFameScore(items, 90).map((item) => item.id)).toEqual(['a', 'c']);
});

test('filterByFameScore keeps a value exactly at the threshold', () => {
  const items = [{ id: 'a', fameScore: 50 }];
  expect(filterByFameScore(items, 50)).toHaveLength(1);
});

// filterByOccupationDomain — People-only Legend-pill filter.
test('filterByOccupationDomain returns items unchanged when no domains are selected', () => {
  const items = [{ id: 'a', occupationDomain: 'arts' as const }, { id: 'b', occupationDomain: 'sports' as const }];
  expect(filterByOccupationDomain(items, [])).toEqual(items);
});

test('filterByOccupationDomain keeps only items whose domain is selected', () => {
  const items = [
    { id: 'a', occupationDomain: 'arts' as const },
    { id: 'b', occupationDomain: 'sports' as const },
    { id: 'c', occupationDomain: 'humanities' as const },
  ];
  expect(filterByOccupationDomain(items, ['arts']).map((item) => item.id)).toEqual(['a']);
});

test('filterByOccupationDomain unions multiple selected domains (OR)', () => {
  const items = [
    { id: 'a', occupationDomain: 'arts' as const },
    { id: 'b', occupationDomain: 'sports' as const },
    { id: 'c', occupationDomain: 'humanities' as const },
  ];
  expect(filterByOccupationDomain(items, ['arts', 'sports']).map((item) => item.id)).toEqual(['a', 'b']);
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
  const items: RegionFixture[] = [{ id: 'a', regionTags: ['western-europe'] }, { id: 'b', regionTags: [] }];
  expect(filterByRegion(items, [], regionsOf)).toEqual(items);
});

test('filterByRegion keeps only items tagged with a selected region', () => {
  const items: RegionFixture[] = [
    { id: 'a', regionTags: ['western-europe'] },
    { id: 'b', regionTags: ['northern-africa'] },
    { id: 'c', regionTags: [] },
  ];
  expect(filterByRegion(items, ['western-europe'], regionsOf).map((item) => item.id)).toEqual(['a']);
});

test('filterByRegion unions multiple selected regions (OR) and matches any tag in a multi-tag item', () => {
  const items: RegionFixture[] = [
    { id: 'a', regionTags: ['western-europe', 'northern-africa'] },
    { id: 'b', regionTags: ['northern-america'] },
    { id: 'c', regionTags: ['southern-asia'] },
  ];
  expect(filterByRegion(items, ['northern-africa', 'northern-america'], regionsOf).map((item) => item.id)).toEqual(['a', 'b']);
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
  const items: MilestoneGroupFixture[] = [{ id: 'a', category: 'science-theory' }];
  expect(filterByMilestoneCategoryGroup(items, [])).toEqual(items);
});

test('filterByMilestoneCategoryGroup excludes items from a non-selected group', () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' }, // science-innovation
    { id: 'b', category: 'commerce-finance' }, // social-culture
  ];
  expect(filterByMilestoneCategoryGroup(items, ['science-innovation']).map((item) => item.id)).toEqual(['a']);
});

test('filterByMilestoneCategoryGroup unions multiple selected groups (OR)', () => {
  const items: MilestoneGroupFixture[] = [
    { id: 'a', category: 'science-theory' }, // science-innovation
    { id: 'b', category: 'commerce-finance' }, // social-culture
    { id: 'c', category: 'law-jurisprudence' }, // social-culture
  ];
  expect(
    filterByMilestoneCategoryGroup(items, ['science-innovation', 'social-culture']).map((item) => item.id),
  ).toEqual(['a', 'b', 'c']);
});

test('filterByMilestoneCategoryGroup ignores a selected \'conflicts\' sentinel — never matches a MilestoneCategoryGroup', () => {
  const items: MilestoneGroupFixture[] = [{ id: 'a', category: 'science-theory' }];
  const selectedValues: ConflictsMilestonesFilterValue[] = ['conflicts'];
  expect(filterByMilestoneCategoryGroup(items, selectedValues)).toEqual([]);
});

test('filterConflictsByFilterValues returns items unchanged when no values are selected', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  expect(filterConflictsByFilterValues(items, [])).toEqual(items);
});

test('filterConflictsByFilterValues keeps items when \'conflicts\' is selected', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const selectedValues: ConflictsMilestonesFilterValue[] = ['conflicts'];
  expect(filterConflictsByFilterValues(items, selectedValues)).toEqual(items);
});

test('filterConflictsByFilterValues excludes items when a non-empty selection omits \'conflicts\'', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const selectedValues: ConflictsMilestonesFilterValue[] = ['science-innovation'];
  expect(filterConflictsByFilterValues(items, selectedValues)).toEqual([]);
});

// assignRows — fame-priority interval-graph row stacking shared by every
// lane. Processes items by fameScore rounded to an integer tier (descending),
// chronologically within a tier, id as the final tie-break — so row 0
// accumulates the highest-fame tier, and packing stays row-minimal within
// a tier instead of fragmenting on every hairline fame difference.
test('assignRows places two non-overlapping intervals in the same row', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910, fameScore: 100 },
    { id: 'b', startYear: 1950, endYear: 1960, fameScore: 50 },
  ]);
  expect(rows.get('a')).toBe(rows.get('b'));
});

test('assignRows opens a new row for two overlapping intervals', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1920, fameScore: 100 },
    { id: 'b', startYear: 1910, endYear: 1930, fameScore: 50 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
});

test('assignRows keeps a minimum gap between two intervals sharing a row, even without literal overlap', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910, fameScore: 100 },
    { id: 'b', startYear: 1911, endYear: 1920, fameScore: 50 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
});

test('assignRows gives the higher-fame item row 0 when two overlapping items compete for it, regardless of input order', () => {
  const overlapping = [
    { id: 'famous', startYear: 1900, endYear: 1920, fameScore: 90 },
    { id: 'obscure', startYear: 1910, endYear: 1930, fameScore: 10 },
  ];
  const forward = assignRows(overlapping);
  expect(forward.get('famous')).toBe(0);
  expect(forward.get('obscure')).toBe(1);

  const reversed = assignRows([...overlapping].reverse());
  expect(reversed.get('famous')).toBe(0);
  expect(reversed.get('obscure')).toBe(1);
});

test('assignRows processes chronologically within the same fame tier, regardless of input order', () => {
  // Same rounded tier (50), but 'earlier' starts first — a time-ordered
  // pass places it in row 0 and 'later' (which overlaps it) in row 1.
  const sameTier = [
    { id: 'later', startYear: 1910, endYear: 1930, fameScore: 50.4 },
    { id: 'earlier', startYear: 1900, endYear: 1920, fameScore: 49.6 },
  ];
  const forward = assignRows(sameTier);
  const reversed = assignRows([...sameTier].reverse());
  expect(forward.get('earlier')).toBe(0);
  expect(forward.get('later')).toBe(1);
  expect(reversed.get('earlier')).toBe(0);
  expect(reversed.get('later')).toBe(1);
});

test('assignRows breaks a same-tier, same-start-year tie by id, deterministically regardless of input order', () => {
  const tied = [
    { id: 'a', startYear: 1900, endYear: 1920, fameScore: 50 },
    { id: 'b', startYear: 1900, endYear: 1930, fameScore: 50 },
  ];
  const forward = assignRows(tied);
  const reversed = assignRows([...tied].reverse());
  expect(forward.get('a')).toBe(0);
  expect(forward.get('b')).toBe(1);
  expect(reversed.get('a')).toBe(0);
  expect(reversed.get('b')).toBe(1);
});

test('assignRows sorts by the rounded tier, not the raw score — a tiny raw gap across a rounding boundary still separates tiers', () => {
  // 89.6 rounds up to tier 90; 89.4 rounds down to tier 89 — a 0.2 raw
  // difference, but two different tiers, so the tier-90 item must win row 0
  // even though a same-tier item that started earlier would have.
  const overlapping = [
    { id: 'tier-89', startYear: 1900, endYear: 1920, fameScore: 89.4 },
    { id: 'tier-90', startYear: 1905, endYear: 1925, fameScore: 89.6 },
  ];
  const forward = assignRows(overlapping);
  expect(forward.get('tier-90')).toBe(0);
  expect(forward.get('tier-89')).toBe(1);

  const reversed = assignRows([...overlapping].reverse());
  expect(reversed.get('tier-90')).toBe(0);
  expect(reversed.get('tier-89')).toBe(1);
});

test('assignRows reuses a row once it clears, rather than always opening a new one', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910, fameScore: 100 },
    { id: 'b', startYear: 1905, endYear: 1915, fameScore: 90 },
    { id: 'c', startYear: 1920, endYear: 1930, fameScore: 80 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
  expect(rows.get('c')).toBe(rows.get('a'));
});

test("assignRows lets a lower-fame item slot in before an already-placed higher-fame item's start, not just after its end", () => {
  // 'famous' is processed first (highest fame) and claims row 0 for
  // [1950, 1960]. 'obscure' is processed later but starts well *before*
  // it, at [1900, 1910] — the old chronological-processing algorithm only
  // ever compared against a row's rightmost extent, so it couldn't detect
  // this as a non-overlap; the fame-priority version must check the whole
  // row.
  const rows = assignRows([
    { id: 'famous', startYear: 1950, endYear: 1960, fameScore: 100 },
    { id: 'obscure', startYear: 1900, endYear: 1910, fameScore: 10 },
  ]);
  expect(rows.get('famous')).toBe(0);
  expect(rows.get('obscure')).toBe(0);
});

// computeRowAssignment / compactRows — the static, filter/zoom-invariant
// row identity every lane derives its own live per-render rows from (see
// options.ts's REFERENCE_PIXELS_PER_YEAR and PeopleLane/
// ConflictsMilestonesLane's own use of personRowFor/eventsRowFor).

test('computeRowAssignment gives two time-overlapping people different rows, the more famous one row 0', () => {
  const famous: Person = { ...person, id: 'Q-famous', fameScore: 999 };
  const obscure: Person = { ...person, id: 'Q-obscure', fameScore: 1 };
  const rows = computeRowAssignment([famous, obscure], [], []).personRowFor(['Q-famous', 'Q-obscure']);
  expect(rows.get('Q-famous')).toBe(0);
  expect(rows.get('Q-obscure')).not.toBe(0);
});

test('computeRowAssignment packs a non-overlapping Conflict and Milestone into the same row', () => {
  const rows = computeRowAssignment([], [conflictWithEndYear], [milestone]).eventsRowFor([conflictWithEndYear.id, milestone.id]);
  expect(rows.get(conflictWithEndYear.id)).toBe(rows.get(milestone.id));
});

test('compactRows re-indexes to consecutive integers starting at 0, in the same relative order as the static rows', () => {
  const staticRowOf = new Map([
    ['a', 2],
    ['b', 5],
    ['c', 9],
  ]);
  const compacted = compactRows(['a', 'b', 'c'], staticRowOf);
  expect(compacted.get('a')).toBe(0);
  expect(compacted.get('b')).toBe(1);
  expect(compacted.get('c')).toBe(2);
});

test('compactRows closes a gap left by a filtered-out item without reordering the remaining two', () => {
  const staticRowOf = new Map([
    ['a', 2],
    ['b', 5],
    ['c', 9],
  ]);
  const compacted = compactRows(['a', 'c'], staticRowOf); // 'b' filtered out
  expect(compacted.get('a')).toBe(0);
  expect(compacted.get('c')).toBe(1);
});

test('compactRows keeps two items that share the same static row in the same compacted row', () => {
  const staticRowOf = new Map([
    ['a', 0],
    ['b', 0],
    ['c', 3],
  ]);
  const compacted = compactRows(['a', 'b', 'c'], staticRowOf);
  expect(compacted.get('a')).toBe(compacted.get('b'));
  expect(compacted.get('c')).not.toBe(compacted.get('a'));
});
