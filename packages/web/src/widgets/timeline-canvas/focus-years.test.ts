import { expect, test } from 'vitest';
import { selectionFocusYears } from './focus-years';

test('no selection falls back to the visible years', () => {
  expect(selectionFocusYears(null)).toBeNull();
});

test('the selected entity focuses on its own span, floored to whole years', () => {
  expect(selectionFocusYears({ startYear: 1769.6, endYear: 1821.4 })).toEqual({
    startYear: 1769,
    endYear: 1821,
  });
});

test('a point focuses on its single year', () => {
  expect(selectionFocusYears({ startYear: 1815.5, endYear: 1815.5 })).toEqual({
    startYear: 1815,
    endYear: 1815,
  });
});
