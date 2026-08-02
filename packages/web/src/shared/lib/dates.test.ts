import { test, expect } from 'vitest';
import { yearToPlainDate, toLegacyDate, today } from './dates';

test('yearToPlainDate handles a CE year', () => {
  const date = yearToPlainDate(1800);
  expect(date.year).toBe(1800);
  expect(date.month).toBe(1);
  expect(date.day).toBe(1);
});

test('yearToPlainDate handles a BCE year', () => {
  const date = yearToPlainDate(-493);
  expect(date.year).toBe(-493);
});

test('toLegacyDate round-trips a CE year', () => {
  const legacy = toLegacyDate(yearToPlainDate(1800));
  expect(legacy.getFullYear()).toBe(1800);
  expect(legacy.getMonth()).toBe(0);
  expect(legacy.getDate()).toBe(1);
});

test('toLegacyDate round-trips a BCE year', () => {
  const legacy = toLegacyDate(yearToPlainDate(-493));
  expect(legacy.getFullYear()).toBe(-493);
  expect(legacy.getMonth()).toBe(0);
  expect(legacy.getDate()).toBe(1);
});

test('today matches a live Temporal.Now.plainDateISO() read', () => {
  expect(today().year).toBe(Temporal.Now.plainDateISO().year);
});
