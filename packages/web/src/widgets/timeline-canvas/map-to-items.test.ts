import { test, expect } from 'vitest';
import { mapInventionsToItems, mapPeopleToItems, mapWarsAndConflictsToItems } from './map-to-items';
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

test('mapPeopleToItems maps a person with both years to a range item', () => {
  const [item] = mapPeopleToItems([person]);
  expect(item?.type).toBe('range');
  expect(item?.group).toBe('people');
  expect((item?.start as Date).getFullYear()).toBe(-383);
  expect((item?.end as Date).getFullYear()).toBe(-321);
});

test('mapPeopleToItems falls back to startYear + 1 when endYear is missing', () => {
  expect(() => mapPeopleToItems([personWithoutDeathYear])).not.toThrow();
  const [item] = mapPeopleToItems([personWithoutDeathYear]);
  expect((item?.end as Date).getFullYear()).toBe(-749);
});

test('mapPeopleToItems does not add a subgroup or extra items for a person with no reignPeriods', () => {
  const items = mapPeopleToItems([person]);
  expect(items).toHaveLength(1);
  expect(items[0]?.subgroup).toBeUndefined();
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

test('mapPeopleToItems emits the person item followed by one range item per reignPeriod, sharing a subgroup', () => {
  const items = mapPeopleToItems([ruler]);
  expect(items).toHaveLength(3);

  const [personItem, firstReign, secondReign] = items;
  expect(personItem?.subgroup).toBe(ruler.id);
  expect(firstReign?.subgroup).toBe(ruler.id);
  expect(secondReign?.subgroup).toBe(ruler.id);
  expect(firstReign?.group).toBe('people');
  expect(firstReign?.type).toBe('range');
  expect((firstReign?.start as Date).getFullYear()).toBe(-49);
  expect((firstReign?.end as Date).getFullYear()).toBe(-44);
});

test('mapPeopleToItems uses the reignPeriod title in the tooltip when present, falling back to "Reign"', () => {
  const [, firstReign, secondReign] = mapPeopleToItems([ruler]);
  expect(firstReign?.title).toBe('Dictator: -49–-44');
  expect(secondReign?.title).toBe('Reign: -60–-59');
});

test('mapPeopleToItems falls back to the person\'s endYear when a reignPeriod has no endYear', () => {
  const rulerWithOpenReign: Person = {
    ...ruler,
    reignPeriods: [{ startYear: -49, endYear: undefined }],
  };
  const [, reignItem] = mapPeopleToItems([rulerWithOpenReign]);
  expect((reignItem?.end as Date).getFullYear()).toBe(-44);
});

test('mapPeopleToItems widens a reignPeriod to one year when both endYear and the person\'s endYear are missing', () => {
  const rulerWithNoBounds: Person = {
    ...ruler,
    endYear: undefined,
    reignPeriods: [{ startYear: -49, endYear: undefined }],
  };
  const [, reignItem] = mapPeopleToItems([rulerWithNoBounds]);
  expect((reignItem?.start as Date).getFullYear()).toBe(-49);
  expect((reignItem?.end as Date).getFullYear()).toBe(-48);
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

test('mapInventionsToItems maps a discovery to a point item with no end', () => {
  const [item] = mapInventionsToItems([discovery]);
  expect(item?.type).toBe('point');
  expect(item?.group).toBe('events');
  expect(item?.end).toBeUndefined();
  expect((item?.start as Date).getFullYear()).toBe(1500);
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
  id: 'Q166376',
  name: 'Six-Day War',
  startYear: 1967,
  endYear: 1967,
  category: 'war',
  regionTags: ['middle-east'],
  fameScore: 300,
  description: 'war between Israel and neighboring states',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Six-Day_War',
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
  id: 'Q217799',
  name: 'Battle of Megiddo',
  startYear: -1457,
  category: 'war',
  regionTags: ['middle-east'],
  fameScore: 120,
  description: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

const politicsEntry: War = {
  id: 'Q131154',
  name: 'Congress of Vienna',
  startYear: 1814,
  category: 'politics',
  regionTags: ['europe'],
  fameScore: 200,
  description: 'diplomatic conference reorganizing Europe',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Congress_of_Vienna',
};

test('mapWarsAndConflictsToItems maps a war with an endYear to a range item', () => {
  const [item] = mapWarsAndConflictsToItems([warWithEndYear]);
  expect(item?.type).toBe('range');
  expect(item?.group).toBe('wars');
  expect((item?.start as Date).getFullYear()).toBe(1950);
  expect((item?.end as Date).getFullYear()).toBe(1953);
});

test('mapWarsAndConflictsToItems widens a zero-width war range (startYear === endYear) by one year', () => {
  const [item] = mapWarsAndConflictsToItems([warZeroWidth]);
  expect(item?.type).toBe('range');
  expect((item?.start as Date).getFullYear()).toBe(1967);
  expect((item?.end as Date).getFullYear()).toBe(1968);
});

test('mapWarsAndConflictsToItems maps an entry without an endYear to a point item with no end', () => {
  const [item] = mapWarsAndConflictsToItems([battleWithoutParent]);
  expect(item?.type).toBe('point');
  expect(item?.group).toBe('wars');
  expect(item?.end).toBeUndefined();
});

test('mapWarsAndConflictsToItems surfaces partOfWarName as the item title', () => {
  const [item] = mapWarsAndConflictsToItems([battleWithParent]);
  expect(item?.title).toBe('Battle of Gettysburg — part of American Civil War');
});

test('mapWarsAndConflictsToItems leaves title unset when partOfWarName is absent', () => {
  const [item] = mapWarsAndConflictsToItems([battleWithoutParent]);
  expect(item?.title).toBeUndefined();
});

test('mapWarsAndConflictsToItems includes politics-category entries, not just wars', () => {
  const items = mapWarsAndConflictsToItems([politicsEntry]);
  expect(items).toHaveLength(1);
  expect(items[0]?.type).toBe('point');
});
