import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDates } from './subjects.js';

test('formatDates writes CE spans and single years', () => {
  assert.equal(formatDates({ startYear: 1789, endYear: 1799 }), '1789–1799');
  assert.equal(formatDates({ startYear: 1969 }), '1969');
  assert.equal(formatDates({ startYear: 1969, endYear: 1969 }), '1969');
  assert.equal(formatDates({ startYear: 476 }), 'AD 476');
});

test('formatDates converts astronomical years to BC', () => {
  assert.equal(formatDates({ startYear: -550, endYear: -478 }), '551–479 BC');
  assert.equal(formatDates({ startYear: -43, endYear: 14 }), '44 BC–AD 14');
  assert.equal(formatDates({ startYear: 0 }), '1 BC');
});

test('formatDates marks living people and approximate dates', () => {
  assert.equal(formatDates({ startYear: 1950, ongoing: true }), '1950–present');
  assert.equal(formatDates({ startYear: 1450, approximate: true }), 'c. 1450');
});
