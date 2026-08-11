import { test, expect } from 'vitest';
import { assignRows, filterByFameScore, mapMilestones, mapPeople, mapConflicts } from './map-to-items';
import { today } from '../../shared/lib/dates';
import type { Milestone, Person, Conflict, ConflictEvent } from '../../shared/types';

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
  regionTags: ['east-asia'],
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
  regionTags: ['americas'],
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
  regionTags: ['europe'],
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

// filterByFameScore — shared client-side Fame Tier gate for all three lanes.
test('filterByFameScore keeps only items whose fameScore clears the threshold', () => {
  const items = [{ id: 'a', fameScore: 90 }, { id: 'b', fameScore: 89 }, { id: 'c', fameScore: 100 }];
  expect(filterByFameScore(items, 90).map((item) => item.id)).toEqual(['a', 'c']);
});

test('filterByFameScore keeps a value exactly at the threshold', () => {
  const items = [{ id: 'a', fameScore: 50 }];
  expect(filterByFameScore(items, 50)).toHaveLength(1);
});

// assignRows — greedy interval-graph row stacking shared by People & Conflicts.
test('assignRows places two non-overlapping intervals in the same row', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910 },
    { id: 'b', startYear: 1950, endYear: 1960 },
  ]);
  expect(rows.get('a')).toBe(rows.get('b'));
});

test('assignRows opens a new row for two overlapping intervals', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1920 },
    { id: 'b', startYear: 1910, endYear: 1930 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
});

test('assignRows keeps a minimum gap between two intervals sharing a row, even without literal overlap', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910 },
    { id: 'b', startYear: 1911, endYear: 1920 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
});

test('assignRows is independent of input order (sorts by startYear internally)', () => {
  const rows = assignRows([
    { id: 'b', startYear: 1950, endYear: 1960 },
    { id: 'a', startYear: 1900, endYear: 1910 },
  ]);
  expect(rows.get('a')).toBe(0);
  expect(rows.get('b')).toBe(0);
});

test('assignRows reuses a row once it clears, rather than always opening a new one', () => {
  const rows = assignRows([
    { id: 'a', startYear: 1900, endYear: 1910 },
    { id: 'b', startYear: 1905, endYear: 1915 },
    { id: 'c', startYear: 1920, endYear: 1930 },
  ]);
  expect(rows.get('a')).not.toBe(rows.get('b'));
  expect(rows.get('c')).toBe(rows.get('a'));
});
