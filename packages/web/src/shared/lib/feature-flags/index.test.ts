import { afterEach, expect, test } from 'vitest';
import { hasFeatureFlag } from './index';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

test('returns false when the query param is absent', () => {
  window.history.pushState({}, '', '/?other=1');
  expect(hasFeatureFlag('fameFilters')).toBe(false);
});

test('returns true when the query param is present', () => {
  window.history.pushState({}, '', '/?fameFilters=1');
  expect(hasFeatureFlag('fameFilters')).toBe(true);
});
