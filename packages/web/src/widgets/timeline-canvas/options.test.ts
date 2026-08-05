import { test, expect } from 'vitest';
import {
  buildXScale,
  clampPixelsPerYear,
  defaultPixelsPerYear,
  fameTierForVisibleYears,
  fameTierForViewport,
  pixelsPerYearBounds,
  zoomIn,
  zoomOut,
  DOMAIN_COLORS,
  CATEGORY_COLORS,
} from './options';
import { today } from '../../shared/lib/dates';
import { PAN_MIN_DATE } from '../../shared/config/viewport';
import { OCCUPATION_DOMAINS, CATEGORIES } from '../../shared/types';

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

test('defaultPixelsPerYear targets the default 100-year (1800-1900) viewport width', () => {
  expect(defaultPixelsPerYear(1000)).toBe(1000 / 100);
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

test('CATEGORY_COLORS has one entry per Category, no duplicate hex values', () => {
  const values = CATEGORIES.map((category) => CATEGORY_COLORS[category]);
  expect(values).toHaveLength(CATEGORIES.length);
  expect(values.every(Boolean)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});

test('fameTierForVisibleYears is CORE zoomed all the way out (500 visible years)', () => {
  expect(fameTierForVisibleYears(500)).toBe('CORE');
});

test('fameTierForVisibleYears is EXHAUSTIVE zoomed all the way in (10 visible years)', () => {
  expect(fameTierForVisibleYears(10)).toBe('EXHAUSTIVE');
});

test('fameTierForVisibleYears is CORE just above the NOTABLE boundary', () => {
  expect(fameTierForVisibleYears(151)).toBe('CORE');
});

test('fameTierForVisibleYears crosses into NOTABLE exactly at the 150-year boundary', () => {
  expect(fameTierForVisibleYears(150)).toBe('NOTABLE');
});

test('fameTierForVisibleYears is NOTABLE just above the EXHAUSTIVE boundary', () => {
  expect(fameTierForVisibleYears(51)).toBe('NOTABLE');
});

test('fameTierForVisibleYears crosses into EXHAUSTIVE exactly at the 50-year boundary', () => {
  expect(fameTierForVisibleYears(50)).toBe('EXHAUSTIVE');
});

test('fameTierForViewport derives visible years from pixelsPerYear and viewport width', () => {
  // 1000px / 5px-per-year = 200 visible years -> CORE band.
  expect(fameTierForViewport(5, 1000)).toBe('CORE');
  // 1000px / 20px-per-year = 50 visible years -> EXHAUSTIVE band.
  expect(fameTierForViewport(20, 1000)).toBe('EXHAUSTIVE');
});

test('fameTierForViewport falls back to a fixed width when the viewport hasn\'t measured yet (width 0)', () => {
  expect(() => fameTierForViewport(1, 0)).not.toThrow();
});
