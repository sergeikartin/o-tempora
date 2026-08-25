import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import type {
  Conflict,
  ConflictEvent,
  Milestone,
  Person,
  Region,
} from '../../../shared/types';
import { useTimelineSearch } from './useTimelineSearch';

interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

const person: Person = {
  id: 'Q868',
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
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['western-asia'],
  fameScore: 60,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

const milestone: Milestone = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['western-europe'],
  fameScore: 95,
  tagline: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

const baseFameScoreValues: FameScoreValues = {
  people: 0,
  conflicts: 0,
  milestones: 0,
};

function setup(
  overrides: Partial<{
    fameScoreValues: FameScoreValues;
    selectedRegions: Region[];
    people: Person[];
  }> = {},
) {
  return renderHook(() =>
    useTimelineSearch({
      people: overrides.people ?? [person],
      conflicts: [conflict, battle],
      milestones: [milestone],
      fameScoreValues: overrides.fameScoreValues ?? baseFameScoreValues,
      selectedDomains: [],
      selectedRegions: overrides.selectedRegions ?? [],
      selectedConflictsMilestonesValues: [],
    }),
  );
}

test('returns no results for an empty query', () => {
  const { result } = setup();
  expect(result.current.results).toEqual([]);
});

test('matches against name, case-insensitively, across all three lanes', () => {
  const { result } = setup();
  act(() => result.current.setQuery('WAR'));
  expect(result.current.results.map((r) => r.name)).toEqual(['Korean War']);
});

test('matches against tagline as well as name', () => {
  const { result } = setup();
  act(() => result.current.setQuery('polymath'));
  expect(result.current.results.map((r) => r.id)).toEqual([person.id]);
});

test('excludes an entity below the active fame-score floor', () => {
  const { result, rerender } = renderHook(
    ({ fameScoreValues }: { fameScoreValues: FameScoreValues }) =>
      useTimelineSearch({
        people: [person],
        conflicts: [conflict, battle],
        milestones: [milestone],
        fameScoreValues,
        selectedDomains: [],
        selectedRegions: [],
        selectedConflictsMilestonesValues: [],
      }),
    { initialProps: { fameScoreValues: baseFameScoreValues } },
  );
  act(() => result.current.setQuery('battle'));
  expect(result.current.results.map((r) => r.id)).toEqual([battle.id]);

  rerender({ fameScoreValues: { people: 0, conflicts: 70, milestones: 0 } });
  expect(result.current.results).toEqual([]);
});

test('excludes an entity outside the active Region filter', () => {
  const { result, rerender } = renderHook(
    ({ selectedRegions }: { selectedRegions: Region[] }) =>
      useTimelineSearch({
        people: [person],
        conflicts: [],
        milestones: [],
        fameScoreValues: baseFameScoreValues,
        selectedDomains: [],
        selectedRegions,
        selectedConflictsMilestonesValues: [],
      }),
    { initialProps: { selectedRegions: [] as Region[] } },
  );
  act(() => result.current.setQuery('aristotle'));
  expect(result.current.results.map((r) => r.id)).toEqual([person.id]);

  rerender({ selectedRegions: ['western-europe'] });
  expect(result.current.results).toEqual([]);
});

test('caps results at 8, ranked by Fame Score across all lanes combined', () => {
  const manyPeople: Person[] = Array.from({ length: 10 }, (_, index) => ({
    ...person,
    id: `Q-${index}`,
    fameScore: index,
  }));
  const { result } = setup({ people: manyPeople });
  act(() => result.current.setQuery('aristotle'));

  expect(result.current.results).toHaveLength(8);
  expect(result.current.results.map((r) => r.fameScore)).toEqual([
    9, 8, 7, 6, 5, 4, 3, 2,
  ]);
});
