import { renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import type {
  Conflict,
  ConflictEvent,
  Milestone,
  Person,
  SearchIndex,
} from '../../../shared/types';
import { useTimelineSearch } from './useTimelineSearch';

const person: Person = {
  id: 'Q868',
  slug: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: ['eastern-europe'],
  fameScore: 90,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const conflict: Conflict = {
  id: 'Q8214',
  slug: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['eastern-asia'],
  fameScore: 85,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battle: ConflictEvent = {
  id: 'Q217799',
  slug: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['western-asia'],
  fameScore: 65,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

const milestone: Milestone = {
  id: 'Q11042',
  slug: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['western-europe'],
  fameScore: 95,
  tagline: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

const index: SearchIndex = {
  people: [person],
  conflicts: [
    conflict,
    battle,
    { ...battle, id: 'below-deep-cut', fameScore: 60 },
  ],
  milestones: [milestone],
};

function search(
  query: string,
  overrides: Partial<Parameters<typeof useTimelineSearch>[0]> = {},
) {
  return renderHook(() =>
    useTimelineSearch({
      query,
      index,
      selectedDomains: [],
      selectedRegions: [],
      selectedConflictsMilestonesValues: [],
      ...overrides,
    }),
  ).result.current;
}

test('returns no results for an empty query', () => {
  expect(search('')).toEqual([]);
});

test('matches names case-insensitively across all three lanes', () => {
  expect(search('WAR').map((result) => result.name)).toEqual(['Korean War']);
  expect(search('PRINTING').map((result) => result.name)).toEqual([
    'Printing press',
  ]);
  expect(search('ARISTOTLE').map((result) => result.name)).toEqual([
    'Aristotle',
  ]);
});

test('matches against tagline as well as name', () => {
  expect(search('polymath').map((result) => result.id)).toEqual([person.id]);
});

test('finds deeper entries and excludes entries below Deep Cut', () => {
  expect(
    search('battle').map(({ id, detailLevel }) => ({ id, detailLevel })),
  ).toEqual([{ id: battle.id, detailLevel: 'deep-cut' }]);
});

test('honors Region, Occupation and Conflicts & Milestones filters', () => {
  expect(search('aristotle', { selectedRegions: ['western-europe'] })).toEqual(
    [],
  );
  expect(search('aristotle', { selectedDomains: ['arts'] })).toEqual([]);
  expect(
    search('battle', {
      selectedConflictsMilestonesValues: ['science-innovation'],
    }),
  ).toEqual([]);
  expect(
    search('printing', { selectedConflictsMilestonesValues: ['conflicts'] }),
  ).toEqual([]);
});

test('caps results at 8, ranked by Fame Score across all lanes combined', () => {
  const manyPeople = Array.from({ length: 10 }, (_, i) => ({
    ...person,
    id: `Q-${i}`,
    fameScore: 81 + i,
  }));
  const results = search('polymath', {
    index: {
      ...index,
      people: manyPeople,
      conflicts: [{ ...conflict, fameScore: 95, tagline: 'Polymath' }],
    },
  });

  expect(results.map((result) => result.fameScore)).toEqual([
    95, 90, 89, 88, 87, 86, 85, 84,
  ]);
});
