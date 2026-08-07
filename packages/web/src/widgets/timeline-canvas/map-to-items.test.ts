import { test, expect } from 'vitest';
import { assignRows, filterByFameScore, mapDiscoveries, mapPeople, mapWars } from './map-to-items';
import { today } from '../../shared/lib/dates';
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

test('mapPeople falls back to today when endYear is missing — still alive, not a collapsed bar', () => {
  const [item] = mapPeople([personWithoutDeathYear]);
  expect(item?.endYear).toBe(today().year);
});

test('mapPeople formats the tooltip with BCE/CE-styled years', () => {
  const [item] = mapPeople([person]);
  expect(item?.tooltip).toBe('Aristotle: 384 BCE–322 BCE');
});

test('mapPeople tooltip says "present" (not a formatted year) for an open-ended lifespan', () => {
  const [item] = mapPeople([personWithoutDeathYear]);
  expect(item?.tooltip).toBe('Hesiod: 751 BCE–present');
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
  expect(first?.tooltip).toBe('Dictator: 50 BCE–45 BCE');
  expect(second?.tooltip).toBe('Reign: 61 BCE–60 BCE');
});

test('mapPeople falls back to the person\'s endYear when a reignPeriod has no endYear', () => {
  const rulerWithOpenReign: Person = { ...ruler, reignPeriods: [{ startYear: -49, endYear: undefined }] };
  const [item] = mapPeople([rulerWithOpenReign]);
  expect(item?.reignPeriods[0]?.endYear).toBe(-44);
});

test('mapPeople reign tooltip says "(end unknown)" (not a formatted year) when the source reignPeriod has no endYear', () => {
  const rulerWithOpenReign: Person = { ...ruler, reignPeriods: [{ startYear: -49, endYear: undefined, title: 'Dictator' }] };
  const [item] = mapPeople([rulerWithOpenReign]);
  expect(item?.reignPeriods[0]?.tooltip).toBe('Dictator: 50 BCE–(end unknown)');
});

test('mapPeople falls back to today for a reignPeriod when both its endYear and the person\'s endYear are missing', () => {
  const rulerWithNoBounds: Person = {
    ...ruler,
    endYear: undefined,
    reignPeriods: [{ startYear: -49, endYear: undefined }],
  };
  const [item] = mapPeople([rulerWithNoBounds]);
  expect(item?.reignPeriods[0]?.startYear).toBe(-49);
  expect(item?.reignPeriods[0]?.endYear).toBe(today().year);
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
  id: 'Q11042',
  name: 'Printing press',
  startYear: 1440,
  category: 'communication',
  regionTags: ['europe'],
  fameScore: 386,
  description: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

test('mapDiscoveries maps a discovery to a point item at its startYear', () => {
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
