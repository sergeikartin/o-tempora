import { expect, test } from 'vitest';
import {
  DEFAULT_DETAIL_LEVEL,
  DETAIL_LEVELS,
  FAME_SCORE_BOUNDS,
} from './viewport';

test('mainstream level equals the existing FAME_SCORE_BOUNDS defaults — launch behavior is unchanged', () => {
  expect(DEFAULT_DETAIL_LEVEL.id).toBe('mainstream');
  expect(DEFAULT_DETAIL_LEVEL.values).toEqual({
    people: FAME_SCORE_BOUNDS.people.default,
    conflicts: FAME_SCORE_BOUNDS.conflicts.default,
    milestones: FAME_SCORE_BOUNDS.milestones.default,
  });
});

test('DETAIL_LEVELS holds all 4 levels, strictly narrowing from legendary to deep-cut per lane', () => {
  expect(DETAIL_LEVELS.map((level) => level.id)).toEqual([
    'legendary',
    'mainstream',
    'specialized',
    'deep-cut',
  ]);
  const [legendary, mainstream, specialized, deepCut] = DETAIL_LEVELS;
  for (const lane of ['people', 'conflicts', 'milestones'] as const) {
    expect(mainstream.values[lane]).toBeLessThan(legendary.values[lane]);
    expect(specialized.values[lane]).toBeLessThan(mainstream.values[lane]);
    expect(deepCut.values[lane]).toBeLessThan(specialized.values[lane]);
  }
});
