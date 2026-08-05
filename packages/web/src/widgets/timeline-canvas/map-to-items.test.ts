import { test, expect } from 'vitest';
import { assignRows, mapDiscoveries, mapPeople, mapWars } from './map-to-items';
import type { Discovery, Person, War } from '../../shared/types';

const person: Person = {
  id: 'Q868',
  name: 'Aristotle',
  startYear: -383,
  endYear: -321,
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
  startYear: -750,
  endYear: undefined,
};

test('mapPeople maps a person with both years to an item with matching start/end', () => {
  const [item] = mapPeople([person]);
  expect(item?.id).toBe(person.id);
  expect(item?.name).toBe('Aristotle');
  expect(item?.startYear).toBe(-383);
  expect(item?.endYear).toBe(-321);
  expect(item?.occupationDomain).toBe('humanities');
});

test('mapPeople falls back to startYear + 1 when endYear is missing', () => {
  const [item] = mapPeople([personWithoutDeathYear]);
  expect(item?.endYear).toBe(-749);
});

test('mapPeople gives a person with no reignPeriods an empty reignPeriods list', () => {
  const [item] = mapPeople([person]);
  expect(item?.reignPeriods).toEqual([]);
});

const ruler: Person = {
  ...person,
  id: 'Q1048',
  name: 'Julius Caesar',
  startYear: -100,
  endYear: -44,
  reignPeriods: [
    { startYear: -49, endYear: -44, title: 'Dictator' },
    { startYear: -60, endYear: -59 },
  ],
};

test('mapPeople maps each reignPeriod to a stripe with matching bounds and a tooltip', () => {
  const [item] = mapPeople([ruler]);
  expect(item?.reignPeriods).toHaveLength(2);
  const [first, second] = item?.reignPeriods ?? [];
  expect(first?.startYear).toBe(-49);
  expect(first?.endYear).toBe(-44);
  expect(first?.tooltip).toBe('Dictator: -49–-44');
  expect(second?.tooltip).toBe('Reign: -60–-59');
});

test('mapPeople falls back to the person\'s endYear when a reignPeriod has no endYear', () => {
  const rulerWithOpenReign: Person = { ...ruler, reignPeriods: [{ startYear: -49, endYear: undefined }] };
  const [item] = mapPeople([rulerWithOpenReign]);
  expect(item?.reignPeriods[0]?.endYear).toBe(-44);
});

test('mapPeople widens a reignPeriod to one year when both endYear and the person\'s endYear are missing', () => {
  const rulerWithNoBounds: Person = {
    ...ruler,
    endYear: undefined,
    reignPeriods: [{ startYear: -49, endYear: undefined }],
  };
  const [item] = mapPeople([rulerWithNoBounds]);
  expect(item?.reignPeriods[0]?.startYear).toBe(-49);
  expect(item?.reignPeriods[0]?.endYear).toBe(-48);
});

const warWithEndYear: War = {
  id: 'Q8214',
  name: 'Korean War',
  startYear: 1950,
  endYear: 1953,
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
  startYear: 1967,
  endYear: 1967,
};

const battleWithParent: War = {
  id: 'Q46341',
  name: 'Battle of Gettysburg',
  startYear: 1863,
  partOfWarName: 'American Civil War',
  category: 'war',
  regionTags: ['americas'],
  fameScore: 250,
  description: 'major battle of the American Civil War',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Gettysburg',
};

const battleWithoutParent: War = {
  ...battleWithParent,
  id: 'Q217799',
  name: 'Battle of Megiddo',
  startYear: -1457,
  partOfWarName: undefined,
};

test('mapWars maps a war with an endYear to a range item (isPoint: false)', () => {
  const [item] = mapWars([warWithEndYear]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1950);
  expect(item?.endYear).toBe(1953);
  expect(item?.category).toBe('war');
});

test('mapWars widens a zero-width war range (startYear === endYear) by one year', () => {
  const [item] = mapWars([warZeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1967);
  expect(item?.endYear).toBe(1968);
});

test('mapWars maps an entry without an endYear to a point item', () => {
  const [item] = mapWars([battleWithoutParent]);
  expect(item?.isPoint).toBe(true);
  expect(item?.startYear).toBe(-1457);
  expect(item?.endYear).toBe(-1457);
});

test('mapWars surfaces partOfWarName in the tooltip', () => {
  const [item] = mapWars([battleWithParent]);
  expect(item?.tooltip).toBe('Battle of Gettysburg — part of American Civil War');
});

test('mapWars falls back to the war name alone when partOfWarName is absent', () => {
  const [item] = mapWars([battleWithoutParent]);
  expect(item?.tooltip).toBe('Battle of Megiddo');
});

const discovery: Discovery = {
  id: 'Q155',
  name: 'Brazil',
  startYear: 1500,
  category: 'invention',
  regionTags: ['americas'],
  fameScore: 386,
  description: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('mapDiscoveries maps a discovery to a point item at its startYear', () => {
  const [item] = mapDiscoveries([discovery]);
  expect(item?.id).toBe(discovery.id);
  expect(item?.name).toBe('Brazil');
  expect(item?.startYear).toBe(1500);
  expect(item?.category).toBe('invention');
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
