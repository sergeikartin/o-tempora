import { test, expect } from 'vitest';
import {
  buildXScale,
  clampPixelsPerYear,
  defaultPixelsPerYear,
  pixelsPerYearBounds,
  zoomIn,
  zoomOut,
  CONFLICT_COLOR,
  MILESTONE_CATEGORY_COLORS,
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
} from './options';
import { today } from '../../shared/lib/dates';
import { PAN_MIN_DATE, DOMAIN_COLORS } from '../../shared/config';
import { OCCUPATION_DOMAINS, MILESTONE_CATEGORIES } from '../../shared/types';

test('buildXScale domains from PAN_MIN_DATE to a live today() read', () => {
  const { scale } = buildXScale(5);
  const [minYear, maxYear] = scale.domain();
  expect(minYear).toBe(PAN_MIN_DATE.year);
  expect(maxYear).toBe(today().year);
});

test('buildXScale sizes totalWidth as totalYears * pixelsPerYear', () => {
  const pixelsPerYear = 5;
  const { scale, totalWidth } = buildXScale(pixelsPerYear);
  const totalYears = today().year - PAN_MIN_DATE.year;
  expect(totalWidth).toBe(totalYears * pixelsPerYear);
  expect(scale.range()).toEqual([0, totalWidth]);
});

function trueMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

test('DECADE/CENTURY_TICK_PHASE_OFFSET_YEARS align MIN_YEAR + offset to a plain multiple of the step (year 0/CE phase)', () => {
  expect(trueMod(PAN_MIN_DATE.year + DECADE_TICK_PHASE_OFFSET_YEARS, DECADE_STEP_YEARS)).toBe(0);
  expect(trueMod(PAN_MIN_DATE.year + CENTURY_TICK_PHASE_OFFSET_YEARS, CENTURY_STEP_YEARS)).toBe(0);
});

test('BCE_DECADE/CENTURY_TICK_PHASE_OFFSET_YEARS align MIN_YEAR + offset to the round-historical BCE phase (year ≡ 1 mod step)', () => {
  // This is the phase format-year.ts's isRoundTickYear/roundTickYearsInRange
  // put BCE ticks on (e.g. -9, -19 for "10 BCE"/"20 BCE") — distinct from
  // the plain 0-phase CE grid above.
  expect(trueMod(PAN_MIN_DATE.year + BCE_DECADE_TICK_PHASE_OFFSET_YEARS, DECADE_STEP_YEARS)).toBe(1);
  expect(trueMod(PAN_MIN_DATE.year + BCE_CENTURY_TICK_PHASE_OFFSET_YEARS, CENTURY_STEP_YEARS)).toBe(1);
});

test('pixelsPerYearBounds: min shows the 500-year zoomMax bound, max shows the 10-year zoomMin bound', () => {
  const { min, max } = pixelsPerYearBounds(1000);
  expect(min).toBe(1000 / 500);
  expect(max).toBe(1000 / 10);
});

test('clampPixelsPerYear clamps a too-small value up to the bound implied by 500 max visible years', () => {
  expect(clampPixelsPerYear(0.1, 1000)).toBe(1000 / 500);
});

test('clampPixelsPerYear clamps a too-large value down to the bound implied by 10 min visible years', () => {
  expect(clampPixelsPerYear(1000, 1000)).toBe(1000 / 10);
});

test('clampPixelsPerYear leaves an in-bounds value untouched', () => {
  const inBounds = 1000 / 100;
  expect(clampPixelsPerYear(inBounds, 1000)).toBe(inBounds);
});

test('defaultPixelsPerYear targets the default 120-year (1740-1860) viewport width', () => {
  expect(defaultPixelsPerYear(1000)).toBe(1000 / 120);
});

test('zoomIn increases pixelsPerYear by the zoom step, clamped to the zoomed-in bound', () => {
  const start = 10;
  expect(zoomIn(start, 1000)).toBeCloseTo(start * 1.2);
  expect(zoomIn(1000, 1000)).toBe(1000 / 10);
});

test('zoomOut decreases pixelsPerYear by the zoom step, clamped to the zoomed-out bound', () => {
  const start = 10;
  expect(zoomOut(start, 1000)).toBeCloseTo(start / 1.2);
  expect(zoomOut(0.1, 1000)).toBe(1000 / 500);
});

test('DOMAIN_COLORS has one entry per OccupationDomain, no duplicate hex values', () => {
  const values = OCCUPATION_DOMAINS.map((domain) => DOMAIN_COLORS[domain]);
  expect(values).toHaveLength(OCCUPATION_DOMAINS.length);
  expect(values.every(Boolean)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});

test('CONFLICT_COLOR is a single flat color, distinct from every MILESTONE_CATEGORY_COLORS hue', () => {
  const milestoneValues = MILESTONE_CATEGORIES.map((category) => MILESTONE_CATEGORY_COLORS[category]);
  expect(CONFLICT_COLOR).toBeTruthy();
  expect(milestoneValues).not.toContain(CONFLICT_COLOR);
});

test('MILESTONE_CATEGORY_COLORS has one entry per MilestoneCategory, no duplicate hex values', () => {
  const values = MILESTONE_CATEGORIES.map((category) => MILESTONE_CATEGORY_COLORS[category]);
  expect(values).toHaveLength(MILESTONE_CATEGORIES.length);
  expect(values.every(Boolean)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});
