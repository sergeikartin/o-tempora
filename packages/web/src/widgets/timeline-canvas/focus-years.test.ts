import { expect, test } from 'vitest';
import { selectionFocusYears } from './focus-years';

const person = { id: 'a', startYear: 1769.6, endYear: 1821.4, isPoint: false };
const war = { id: 'b', startYear: 1803, endYear: 1815.9, isPoint: false };
const battle = { id: 'c', startYear: 1815.5, endYear: 1815.5, isPoint: true };

test('no selection falls back to the visible years', () => {
  expect(selectionFocusYears(null)).toBeNull();
  expect(selectionFocusYears({ spans: [], overlap: null })).toBeNull();
});

test('one member focuses on its own span, floored to whole years', () => {
  expect(selectionFocusYears({ spans: [person], overlap: null })).toEqual({
    startYear: 1769,
    endYear: 1821,
    isOverlap: false,
  });
});

test('a point member focuses on its single year', () => {
  expect(selectionFocusYears({ spans: [battle], overlap: null })).toEqual({
    startYear: 1815,
    endYear: 1815,
    isOverlap: false,
  });
});

test('several members focus on the span they share', () => {
  expect(
    selectionFocusYears({
      spans: [person, war],
      overlap: { startYear: 1803, endYear: 1815.9 },
    }),
  ).toEqual({ startYear: 1803, endYear: 1815, isOverlap: true });
});

test('several members with no shared span fall back to the visible years', () => {
  expect(
    selectionFocusYears({ spans: [person, war], overlap: null }),
  ).toBeNull();
});
