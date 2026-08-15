import { test, expect } from 'vitest';
import {
  buildXScale,
  clampPixelsPerYear,
  defaultPixelsPerYear,
  pixelsPerYearBounds,
  zoomIn,
  zoomOut,
  MILESTONE_CATEGORY_COLORS,
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
} from './options';
import { today } from '../../shared/lib/dates';
import {
  PAN_MIN_DATE,
  DOMAIN_COLORS,
  MILESTONE_CATEGORY_GROUP_COLORS,
  CONFLICT_COLOR,
  ZOOM_MAX_YEARS,
  ZOOM_MIN_YEARS,
} from '../../shared/config';
import { OCCUPATION_DOMAINS, MILESTONE_CATEGORIES, MILESTONE_CATEGORY_GROUPS, MILESTONE_CATEGORY_TO_GROUP } from '../../shared/types';

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

test('pixelsPerYearBounds: min shows the ZOOM_MAX_YEARS bound, max shows the ZOOM_MIN_YEARS bound', () => {
  const { min, max } = pixelsPerYearBounds(1000);
  expect(min).toBe(1000 / ZOOM_MAX_YEARS);
  expect(max).toBe(1000 / ZOOM_MIN_YEARS);
});

test('clampPixelsPerYear clamps a too-small value up to the bound implied by ZOOM_MAX_YEARS visible years', () => {
  expect(clampPixelsPerYear(0.1, 1000)).toBe(1000 / ZOOM_MAX_YEARS);
});

test('clampPixelsPerYear clamps a too-large value down to the bound implied by ZOOM_MIN_YEARS visible years', () => {
  expect(clampPixelsPerYear(1000, 1000)).toBe(1000 / ZOOM_MIN_YEARS);
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
  expect(zoomIn(1000, 1000)).toBe(1000 / ZOOM_MIN_YEARS);
});

test('zoomOut decreases pixelsPerYear by the zoom step, clamped to the zoomed-out bound', () => {
  const start = 10;
  expect(zoomOut(start, 1000)).toBeCloseTo(start / 1.2);
  expect(zoomOut(0.1, 1000)).toBe(1000 / ZOOM_MAX_YEARS);
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

test('MILESTONE_CATEGORY_COLORS has one entry per MilestoneCategory, folded into exactly 2 group hexes', () => {
  const values = MILESTONE_CATEGORIES.map((category) => MILESTONE_CATEGORY_COLORS[category]);
  expect(values).toHaveLength(MILESTONE_CATEGORIES.length);
  expect(values.every(Boolean)).toBe(true);
  // "Ledger & Ink" folds the 21-category taxonomy into 2 legible color
  // groups (Science & Innovation / Social & Human Culture) — duplicate hex
  // across categories is the intended design, not an accident, so this
  // asserts the fold lands on exactly 2 distinct hexes rather than the old
  // one-hue-per-category invariant.
  expect(new Set(values).size).toBe(2);
});

test('MILESTONE_CATEGORY_COLORS is derived from MILESTONE_CATEGORY_TO_GROUP + MILESTONE_CATEGORY_GROUP_COLORS', () => {
  for (const category of MILESTONE_CATEGORIES) {
    const group = MILESTONE_CATEGORY_TO_GROUP[category];
    expect(MILESTONE_CATEGORY_COLORS[category]).toBe(MILESTONE_CATEGORY_GROUP_COLORS[group]);
  }
});

test('MILESTONE_CATEGORY_TO_GROUP covers every MilestoneCategory, resolving to exactly one of the 2 groups', () => {
  for (const category of MILESTONE_CATEGORIES) {
    expect(MILESTONE_CATEGORY_GROUPS).toContain(MILESTONE_CATEGORY_TO_GROUP[category]);
  }
  const coveredCategories = new Set(Object.keys(MILESTONE_CATEGORY_TO_GROUP));
  expect(coveredCategories.size).toBe(MILESTONE_CATEGORIES.length);
});
