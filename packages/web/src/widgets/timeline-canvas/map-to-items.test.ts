import { test, expect } from 'vitest';
import { mapPeopleToItems } from './map-to-items';
import type { Person } from '../../shared/types';

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
    { startYear: -49, endYear: -44 },
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
