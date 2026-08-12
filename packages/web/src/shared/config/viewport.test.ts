import { test, expect } from 'vitest';
import { DATA_DEPTH_LEVELS, matchDataDepthLevel, FAME_SCORE_BOUNDS } from './viewport';

test('curated level equals the existing FAME_SCORE_BOUNDS defaults — launch behavior is unchanged', () => {
  const curated = DATA_DEPTH_LEVELS.find((level) => level.id === 'curated');
  expect(curated?.values).toEqual({
    people: FAME_SCORE_BOUNDS.people.default,
    conflicts: FAME_SCORE_BOUNDS.conflicts.default,
    milestones: FAME_SCORE_BOUNDS.milestones.default,
  });
});

test('matchDataDepthLevel matches each preset row exactly', () => {
  for (const level of DATA_DEPTH_LEVELS) {
    expect(matchDataDepthLevel(level.values)).toBe(level.id);
  }
});

test('matchDataDepthLevel returns null for values that match no preset row (custom)', () => {
  expect(matchDataDepthLevel({ people: 88, conflicts: 75, milestones: 75 })).toBeNull();
});
