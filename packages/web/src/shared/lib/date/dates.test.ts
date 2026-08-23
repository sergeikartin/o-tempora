import { expect, test } from 'vitest';
import { today, yearMonthToFractionalYear } from './dates';

test('today matches a live Date read', () => {
  expect(today()).toBe(new Date().getFullYear());
});

test('yearMonthToFractionalYear returns the plain year when month is absent', () => {
  expect(yearMonthToFractionalYear({ year: 1950 })).toBe(1950);
});

test('yearMonthToFractionalYear treats January as the start of the year (no offset)', () => {
  expect(yearMonthToFractionalYear({ year: 1950, month: 1 })).toBe(1950);
});

test('yearMonthToFractionalYear offsets December to 11/12 through the year', () => {
  expect(yearMonthToFractionalYear({ year: 1950, month: 12 })).toBeCloseTo(
    1950 + 11 / 12,
  );
});

test('yearMonthToFractionalYear offsets a mid-year month proportionally', () => {
  // July (month 7): 6 whole months already elapsed since January.
  expect(yearMonthToFractionalYear({ year: 1950, month: 7 })).toBeCloseTo(
    1950 + 6 / 12,
  );
});

test('yearMonthToFractionalYear works the same way for BCE years', () => {
  expect(yearMonthToFractionalYear({ year: -383, month: 7 })).toBeCloseTo(
    -383 + 6 / 12,
  );
});
