import { expect, test } from 'vitest';
import { entityLinkSearch, readEntityLinkSlug } from './entity-link';

test('reads the entity slug from the query string', () => {
  expect(readEntityLinkSlug('?e=Q362')).toBe('Q362');
  expect(readEntityLinkSlug('?x=1&e=b')).toBe('b');
});

test('reads nothing when the param is absent or empty', () => {
  expect(readEntityLinkSlug('')).toBeNull();
  expect(readEntityLinkSlug('?x=1')).toBeNull();
  expect(readEntityLinkSlug('?e=')).toBeNull();
});

test('opens only the first slug of a link that repeats the param', () => {
  expect(readEntityLinkSlug('?e=a&e=b')).toBe('a');
  expect(readEntityLinkSlug('?e=&e=b')).toBe('b');
});

test('sets the entity param, replacing any existing ones', () => {
  expect(entityLinkSearch('Q1')).toBe('?e=Q1');
  expect(entityLinkSearch('Q2', '?e=Q1')).toBe('?e=Q2');
  expect(entityLinkSearch('a', '?e=b&e=c')).toBe('?e=a');
});

test('keeps other params and encodes the slug', () => {
  expect(entityLinkSearch('a b', '?x=1')).toBe('?x=1&e=a+b');
});

test('removes the param, leaving an empty string when nothing else remains', () => {
  expect(entityLinkSearch(null, '?e=Q1&e=Q2')).toBe('');
  expect(entityLinkSearch(null, '?x=1&e=Q1')).toBe('?x=1');
});
