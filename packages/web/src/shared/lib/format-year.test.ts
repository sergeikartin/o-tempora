import { test, expect } from 'vitest';
import { centuryBoundariesInRange, formatYear, isBceYear } from './format-year';

test('isBceYear treats year 0 (1 BCE, astronomical numbering) as BCE', () => {
  expect(isBceYear(0)).toBe(true);
});

test('isBceYear treats year 1 (1 CE) as not BCE', () => {
  expect(isBceYear(1)).toBe(false);
});

test('isBceYear is true for negative years', () => {
  expect(isBceYear(-489)).toBe(true);
});

test('isBceYear is true for positive years', () => {
  expect(isBceYear(1950)).toBe(false);
});

test('formatYear renders year 0 as "1 BCE"', () => {
  expect(formatYear(0)).toBe('1 BCE');
});

test('formatYear renders year 1 as "1 CE"', () => {
  expect(formatYear(1)).toBe('1 CE');
});

test('formatYear renders a negative year as N BCE, offset by one from the astronomical year', () => {
  // Battle of Marathon: astronomical year -489 is the historical 490 BCE.
  expect(formatYear(-489)).toBe('490 BCE');
});

test('formatYear renders a positive year as N CE', () => {
  expect(formatYear(1950)).toBe('1950 CE');
});

test('centuryBoundariesInRange labels a CE range with decade-style "N00s" names', () => {
  const boundaries = centuryBoundariesInRange(1850, 1920);
  expect(boundaries.map((b) => b.label)).toEqual(['1800s', '1900s']);
});

test('centuryBoundariesInRange labels a BCE range with ordinal century names', () => {
  const boundaries = centuryBoundariesInRange(-250, -50);
  expect(boundaries.map((b) => b.label)).toEqual(['3rd century BCE', '2nd century BCE', '1st century BCE']);
});

test('centuryBoundariesInRange spans the BCE/CE boundary correctly', () => {
  const boundaries = centuryBoundariesInRange(-50, 50);
  expect(boundaries.map((b) => b.label)).toEqual(['1st century BCE', '1st century CE']);
});

test('centuryBoundariesInRange gives each boundary a contiguous, non-overlapping year span', () => {
  const boundaries = centuryBoundariesInRange(-250, 250);
  for (let i = 1; i < boundaries.length; i++) {
    expect(boundaries[i]?.startYear).toBe((boundaries[i - 1]?.endYear ?? 0) + 1);
  }
});

test('centuryBoundariesInRange uses ordinal suffixes correctly past the teens (11th-13th stay "th")', () => {
  const boundaries = centuryBoundariesInRange(-1290, -1210);
  expect(boundaries.map((b) => b.label)).toEqual(['13th century BCE']);
});
