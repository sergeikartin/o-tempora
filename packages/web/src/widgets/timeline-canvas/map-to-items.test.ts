import { test, expect } from 'vitest';
import { mapPeopleToItems, mapEventsToItems } from './map-to-items';
import type { HistoricalEvent, Person } from '../../shared/types';

const person: Person = {
  id: 'Q868',
  name: 'Aristotle',
  birthYear: -383,
  deathYear: -321,
  category: 'philosophy',
  occupationTags: ['philosophy'],
  regionTags: [],
  fameScore: 317,
  description: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const personWithoutDeathYear: Person = {
  ...person,
  id: 'Q40939',
  name: 'Hesiod',
  birthYear: -750,
  deathYear: undefined,
};

const event: HistoricalEvent = {
  id: 'Q155',
  name: 'Brazil',
  date: 1500,
  category: 'invention',
  regionTags: ['americas'],
  fameScore: 386,
  description: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('mapPeopleToItems maps a person with both years to a range item', () => {
  const [item] = mapPeopleToItems([person]);
  expect(item?.type).toBe('range');
  expect(item?.group).toBe('people');
  expect((item?.start as Date).getFullYear()).toBe(-383);
  expect((item?.end as Date).getFullYear()).toBe(-321);
});

test('mapPeopleToItems falls back to birthYear + 1 when deathYear is missing', () => {
  expect(() => mapPeopleToItems([personWithoutDeathYear])).not.toThrow();
  const [item] = mapPeopleToItems([personWithoutDeathYear]);
  expect((item?.end as Date).getFullYear()).toBe(-749);
});

test('mapEventsToItems maps an event to a point item with no end', () => {
  const [item] = mapEventsToItems([event]);
  expect(item?.type).toBe('point');
  expect(item?.group).toBe('events');
  expect(item?.end).toBeUndefined();
});
