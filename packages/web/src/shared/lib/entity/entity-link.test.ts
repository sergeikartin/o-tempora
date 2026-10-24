import { expect, test } from 'vitest';
import { entityLinkSearch, readEntityLinkSlugs } from './entity-link';

test('reads the entity slugs from the query string, in order', () => {
  expect(readEntityLinkSlugs('?e=Q362')).toEqual(['Q362']);
  expect(readEntityLinkSlugs('?x=1&e=b&e=a')).toEqual(['b', 'a']);
});

test('reads nothing when the param is absent or empty', () => {
  expect(readEntityLinkSlugs('')).toEqual([]);
  expect(readEntityLinkSlugs('?x=1')).toEqual([]);
  expect(readEntityLinkSlugs('?e=')).toEqual([]);
});

test('ignores repeated slugs and anything beyond four', () => {
  expect(readEntityLinkSlugs('?e=a&e=a&e=b')).toEqual(['a', 'b']);
  expect(readEntityLinkSlugs('?e=a&e=b&e=c&e=d&e=f')).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
});

test('sets the entity params, replacing any existing ones', () => {
  expect(entityLinkSearch(['Q1'])).toBe('?e=Q1');
  expect(entityLinkSearch(['Q2'], '?e=Q1')).toBe('?e=Q2');
  expect(entityLinkSearch(['a', 'b'], '?e=c')).toBe('?e=a&e=b');
});

test('keeps other params and encodes the slug', () => {
  expect(entityLinkSearch(['a b'], '?x=1')).toBe('?x=1&e=a+b');
});

test('removes the params, leaving an empty string when nothing else remains', () => {
  expect(entityLinkSearch([], '?e=Q1&e=Q2')).toBe('');
  expect(entityLinkSearch([], '?x=1&e=Q1')).toBe('?x=1');
});
