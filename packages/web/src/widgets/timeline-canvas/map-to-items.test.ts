import { test, expect } from 'vitest';
import { assignRows, filterByFameScore, mapDiscoveries, mapPeople, mapWars } from './map-to-items';
import { today } from '../../shared/lib/dates';
import type { Discovery, Person, War, WarEvent } from '../../shared/types';

const person: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  description: '4th-century BCE Classical Greek philosopher and polymath',
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

const warWithEndYear: War = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['east-asia'],
  fameScore: 350,
  description: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const warZeroWidth: War = {
  ...warWithEndYear,
  id: 'Q166376',
  name: 'Six-Day War',
  period: { start: { year: 1967 }, end: { year: 1967 } },
};

const battle: WarEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['americas'],
  fameScore: 250,
  description: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

test('mapWars maps a War to a range item (isPoint: false)', () => {
  const [item] = mapWars([warWithEndYear]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1950);
  expect(item?.endYear).toBe(1953);
  expect(item?.category).toBe('war');
});

test('mapWars widens a zero-width war range (start === end) by one year', () => {
  const [item] = mapWars([warZeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1967);
  expect(item?.endYear).toBe(1968);
});

test('mapWars maps a WarEvent to a point item', () => {
  const [item] = mapWars([battle]);
  expect(item?.isPoint).toBe(true);
  expect(item?.startYear).toBe(-1457);
  expect(item?.endYear).toBe(-1457);
});

const discovery: Discovery = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['europe'],
  fameScore: 386,
  description: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

test('mapDiscoveries maps a discovery to a point item at its at.year', () => {
  const [item] = mapDiscoveries([discovery]);
  expect(item?.id).toBe(discovery.id);
  expect(item?.name).toBe('Printing press');
  expect(item?.startYear).toBe(1440);
  expect(item?.category).toBe('communication');
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

// assignRows — greedy interval-graph row stacking shared by People & Wars.
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
