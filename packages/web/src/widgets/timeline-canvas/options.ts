import * as d3 from 'd3';
import { today } from '../../shared/lib/dates';
import {
  ZOOM_MIN_YEARS,
  ZOOM_MAX_YEARS,
  DEFAULT_VIEWPORT_START,
  DEFAULT_VIEWPORT_END,
  PAN_MIN_DATE,
} from '../../shared/config/viewport';
import type { Category, OccupationDomain } from '../../shared/types';

// Row/bar layout shared by every lane's D3 rendering.
export const BAR_HEIGHT = 16;
export const ROW_GAP = 8;
export const ROW_PITCH = BAR_HEIGHT + ROW_GAP;
export const LANE_TOP_PADDING = 12;
export const AXIS_HEIGHT = 28;
export const REIGN_STRIPE_HEIGHT = 3;
export const POINT_RADIUS = 5;
// Minimum gap (in scroll years) kept between two bars placed in the same
// row — pure visual breathing room, not a claim about the underlying dates.
export const MIN_ROW_GAP_YEARS = 5;

// Below-marker label layout, shared by Wars & Conflicts (both its range
// lines and point dots) and Events & Inventions (dots only) — the two lanes
// that carry their label below the marker rather than inside/beside it.
// PeopleLane's solid bars are unaffected and keep ROW_PITCH above.
export const RANGE_LINE_HEIGHT = 2;
export const MARKER_LABEL_GAP = 4;
export const STEM_HEIGHT = 6;
// Rough per-character estimate for the 11px label font — good enough to
// size row-stacking without a real DOM text-measurement pass.
export const AVG_CHAR_WIDTH_PX = 6;
// Row-stacking gap for below-marker layouts — real screen pixels, not years,
// so much smaller than MIN_ROW_GAP_YEARS.
export const MIN_ROW_GAP_PX = 8;
// Approx rendered height of an 11px below-marker label.
const LABEL_TEXT_HEIGHT_PX = 13;
// The point dot + stem + label is the tallest content that shares a row in
// either lane (a range line + label is shorter) — this is the row pitch for
// both lanes' below-marker layouts.
export const MARKER_ROW_PITCH = POINT_RADIUS * 2 + STEM_HEIGHT + LABEL_TEXT_HEIGHT_PX + ROW_GAP;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

// Mirrors design-tokens.md's Occupation Domain Palette. Inlined because
// Unit 5 hasn't wired those tokens as CSS custom properties yet (ticket 05,
// blocked on Unit 5's still-open decisions) — swap for `var(--color-domain-*)`
// once it lands.
export const DOMAIN_COLORS: Record<OccupationDomain, string> = {
  institutions: '#C08A7C',
  arts: '#C0A37C',
  'business-law': '#B3C07C',
  'public-figure': '#8AC7A4',
  'science-technology': '#61B89E',
  exploration: '#7C84C0',
  humanities: '#B35680',
  sports: '#C38393',
};

// Mirrors design-tokens.md's Occupation Category Palette — Wars & Conflicts
// and Events & Inventions both key their flat fill off `category`, unlike
// People's `occupationDomain` above. Same provisional-inlining reasoning.
export const CATEGORY_COLORS: Record<Category, string> = {
  science: '#7FA6C4',
  politics: '#D8A34D',
  art: '#C98A9A',
  philosophy: '#8CAE8A',
  war: '#B06156',
  invention: '#6FA8A0',
  exploration: '#D08A54',
  religion: '#A891C4',
};

// Tentative pick per docs/active-context.md's Next Up (mirrors
// color-accent-selected, not yet decoupled into its own token) — real token
// wiring is ticket 05.
export const REIGN_STRIPE_COLOR = '#B8842E';

const MIN_YEAR = PAN_MIN_DATE.year;

/** Shared time domain: the D3 x-axis for every lane, keyed by pixels-per-year zoom level. */
export function buildXScale(pixelsPerYear: number): { scale: d3.ScaleLinear<number, number>; totalWidth: number } {
  const maxYear = today().year;
  const totalYears = maxYear - MIN_YEAR;
  const totalWidth = totalYears * pixelsPerYear;
  const scale = d3.scaleLinear().domain([MIN_YEAR, maxYear]).range([0, totalWidth]);
  return { scale, totalWidth };
}

export const DEFAULT_VISIBLE_YEARS = DEFAULT_VIEWPORT_END.year - DEFAULT_VIEWPORT_START.year;

const ZOOM_STEP = 0.2;
// Real browsers report the scroll container's actual clientWidth; this only
// matters before that ref has measured anything (e.g. jsdom in tests, or a
// not-yet-laid-out first paint).
const FALLBACK_VIEWPORT_WIDTH_PX = 1000;

/**
 * Pixels-per-year bounds implied by ZOOM_MIN_YEARS/ZOOM_MAX_YEARS (the same
 * bounds vis-timeline's zoomMin/zoomMax enforced) at a given viewport width:
 * `min` shows ZOOM_MAX_YEARS at once (zoomed all the way out), `max` shows
 * ZOOM_MIN_YEARS at once (zoomed all the way in).
 */
export function pixelsPerYearBounds(viewportWidthPx: number): { min: number; max: number } {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return { min: width / ZOOM_MAX_YEARS, max: width / ZOOM_MIN_YEARS };
}

export function clampPixelsPerYear(pixelsPerYear: number, viewportWidthPx: number): number {
  const { min, max } = pixelsPerYearBounds(viewportWidthPx);
  return Math.min(max, Math.max(min, pixelsPerYear));
}

/** Initial zoom level: shows DEFAULT_VISIBLE_YEARS (the old default start/end window) at once. */
export function defaultPixelsPerYear(viewportWidthPx: number): number {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return clampPixelsPerYear(width / DEFAULT_VISIBLE_YEARS, width);
}

export function zoomIn(pixelsPerYear: number, viewportWidthPx: number): number {
  return clampPixelsPerYear(pixelsPerYear * (1 + ZOOM_STEP), viewportWidthPx);
}

export function zoomOut(pixelsPerYear: number, viewportWidthPx: number): number {
  return clampPixelsPerYear(pixelsPerYear / (1 + ZOOM_STEP), viewportWidthPx);
}
