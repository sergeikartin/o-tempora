import { test, expect } from 'vitest';
import {
  buildXScale,
  clampPixelsPerYear,
  defaultPixelsPerYear,
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

test('pixelsPerYearBounds: min shows the 250-year zoomMax bound, max shows the 10-year zoomMin bound', () => {
  const { min, max } = pixelsPerYearBounds(1000);
  expect(min).toBe(1000 / 250);
  expect(max).toBe(1000 / 10);
});

test('clampPixelsPerYear clamps a too-small value up to the bound implied by 250 max visible years', () => {
  expect(clampPixelsPerYear(0.1, 1000)).toBe(1000 / 250);
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
  expect(zoomOut(0.1, 1000)).toBe(1000 / 250);
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
