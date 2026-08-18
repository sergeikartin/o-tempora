import { test, expect, vi } from 'vitest';
import { validateEntries } from './locale-datasets';
import type { Person } from '../shared/types';

vi.mock('../shared/lib/log-error', () => ({ logError: vi.fn() }));

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'Q1',
    name: 'Ada Lovelace',
    fameScore: 50,
    tagline: 'Mathematician',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
    occupationDomain: 'science-technology',
    regionTags: ['western-europe'],
    lifespan: { start: { year: 1815 }, end: { year: 1852 } },
    ...overrides,
  };
}

test('keeps well-formed entries', () => {
  const entries = [person()];
  expect(validateEntries(entries, 'person')).toEqual(entries);
});

test('drops an entry missing an id', () => {
  const entries = [person({ id: '' })];
  expect(validateEntries(entries, 'person')).toEqual([]);
});

test('drops an entry with a non-finite primary year', () => {
  const entries = [person({ lifespan: { start: { year: Number.NaN } } })];
  expect(validateEntries(entries, 'person')).toEqual([]);
});
