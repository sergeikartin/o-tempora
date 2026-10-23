import { expect, test } from 'vitest';
import { entityLinkSearch, readEntityLinkSlug } from './entity-link';

test('reads the entity slug from the query string', () => {
  expect(readEntityLinkSlug('?e=Q362')).toBe('Q362');
  expect(readEntityLinkSlug('?x=1&e=Q362')).toBe('Q362');
});

test('reads null when the param is absent or empty', () => {
  expect(readEntityLinkSlug('')).toBeNull();
  expect(readEntityLinkSlug('?x=1')).toBeNull();
  expect(readEntityLinkSlug('?e=')).toBeNull();
});

test('sets the entity param, replacing any existing one', () => {
  expect(entityLinkSearch('Q1')).toBe('?e=Q1');
  expect(entityLinkSearch('Q2', '?e=Q1')).toBe('?e=Q2');
});

test('keeps other params and encodes the slug', () => {
  expect(entityLinkSearch('a b', '?x=1')).toBe('?x=1&e=a+b');
});

test('removes the param, leaving an empty string when nothing else remains', () => {
  expect(entityLinkSearch(null, '?e=Q1')).toBe('');
  expect(entityLinkSearch(null, '?x=1&e=Q1')).toBe('?x=1');
});
