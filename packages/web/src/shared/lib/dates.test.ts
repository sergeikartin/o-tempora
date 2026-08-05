import { test, expect } from 'vitest';
import { today } from './dates';

test('today matches a live Temporal.Now.plainDateISO() read', () => {
  expect(today().year).toBe(Temporal.Now.plainDateISO().year);
});
