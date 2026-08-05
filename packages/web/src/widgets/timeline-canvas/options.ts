import * as d3 from 'd3';
import { today } from '../../shared/lib/dates';
import {
  ZOOM_MIN_YEARS,
  ZOOM_MAX_YEARS,
  DEFAULT_VIEWPORT_START,
  DEFAULT_VIEWPORT_END,
  PAN_MIN_DATE,
  FAME_TIER_YEAR_BOUNDS,
  type FameTierName,
} from '../../shared/config/viewport';
import type { Category, OccupationDomain } from '../../shared/types';

// Row/bar layout shared by every lane's D3 rendering.
export const BAR_HEIGHT = 16;
export const ROW_GAP = 8;
export const ROW_PITCH = BAR_HEIGHT + ROW_GAP;
export const LANE_TOP_PADDING = 12;
// Year Axis: a ruler bar whose tick marks are pure CSS (three layered
// repeating background-gradients — year/decade/century — no per-tick DOM
// node, so its cost is ~flat regardless of the scrollable width) plus a
// label row below showing decade numbers as plain positioned elements,
// windowed to the visible viewport (+ buffer — see TimelineCanvas's
// VIEWPORT_BUFFER_RATIO). Replaces an earlier design that generated one DOM
// node per tick (first via d3's adaptive axisBottom, later a fixed-step D3
// join) — sizing tick count off the entire scrollable width regardless of
// scroll position was the single biggest contributor to initial-load time;
// the CSS-gradient approach sidesteps that per-tick cost entirely rather
// than just windowing it.
export const YEAR_STEP_YEARS = 1;
export const DECADE_STEP_YEARS = 10;
export const CENTURY_STEP_YEARS = 100;
export const RULER_HEIGHT = 20;
export const RULER_LABEL_ROW_HEIGHT = 18;
export const AXIS_HEIGHT = RULER_HEIGHT + RULER_LABEL_ROW_HEIGHT;
// Tick height as a % of RULER_HEIGHT, top-anchored (a tick "hangs down"
// from the top of the ruler bar, taller = more prominent) — passed as CSS
// custom properties rather than baked into the CSS Module since the
// underlying px spacing is zoom-dependent (see TimelineCanvas's
// `--year-tick-px`/`--decade-tick-px`/`--century-tick-px` custom properties).
export const YEAR_TICK_HEIGHT_PCT = 30;
export const DECADE_TICK_HEIGHT_PCT = 55;
export const CENTURY_TICK_HEIGHT_PCT = 100;
// Decade labels are skipped once zoomed out far enough that a decade's
// pixel width would make the year text collide with its neighbor's —
// century labels are still shown, spaced 10x further apart.
export const MIN_DECADE_LABEL_SPACING_PX = 40;
export const REIGN_STRIPE_HEIGHT = 3;
export const POINT_RADIUS = 5;
// Minimum gap (in scroll years) kept between two bars placed in the same
// row — pure visual breathing room, not a claim about the underlying dates.
export const MIN_ROW_GAP_YEARS = 5;

// Below-marker label layout, shared by Wars & Conflicts (both its range
// lines and point dots) and Events & Inventions (dots only) — the two lanes
// that carry their label below the marker rather than inside/beside it.
// PeopleLane's solid bars are unaffected and keep ROW_PITCH above.
//
// Every marker (range line or point dot) sits at the same fixed y right at
// the top of its lane — i.e. right under the shared YearAxis for Wars &
// Conflicts, the lane directly below it — so a marker's x-position always
// reads directly against the axis above it. Overlapping labels are staggered
// by STEM length (one MARKER_ROW_PITCH tier per row) instead of moving the
// marker itself, so the "row" assignRows hands back is a stem-length tier,
// not a vertical band with its own marker.
export const RANGE_LINE_HEIGHT = 2;
export const STEM_HEIGHT = 6;
// Rough per-character estimate for the 11px label font — good enough to
// size row-stacking without a real DOM text-measurement pass.
export const AVG_CHAR_WIDTH_PX = 6;
// Row-stacking gap for below-marker layouts — real screen pixels, not years,
// so much smaller than MIN_ROW_GAP_YEARS.
export const MIN_ROW_GAP_PX = 8;
// Approx rendered height of an 11px below-marker label.
const LABEL_TEXT_HEIGHT_PX = 13;
// Small breathing room between a stem's tip and its label's text.
export const STEM_LABEL_GAP = 3;
// Vertical budget per stem-length tier — enough for one label's height plus
// breathing room, so consecutive tiers' labels never collide.
export const MARKER_ROW_PITCH = LABEL_TEXT_HEIGHT_PX + ROW_GAP;
// Fixed y every marker (line or dot) is centered on, using the point dot's
// radius as the reference since it's the taller of the two marker shapes.
export const MARKER_CENTER_Y = LANE_TOP_PADDING + POINT_RADIUS;
// y every stem starts from — the bottom edge of the (taller) dot marker.
const STEM_TOP_Y = MARKER_CENTER_Y + POINT_RADIUS;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

/** y of a row's stem tip — row 0 is the shortest stem. */
export function stemBottomForRow(row: number): number {
  return STEM_TOP_Y + STEM_HEIGHT + row * MARKER_ROW_PITCH;
}

/** y of a row's label, a small gap below its stem's tip. */
export function labelYForRow(row: number): number {
  return stemBottomForRow(row) + STEM_LABEL_GAP;
}

/** Total SVG height needed for a below-marker lane with this many stacked rows. */
export function markerLaneHeight(rowCount: number): number {
  if (rowCount === 0) return LANE_TOP_PADDING * 2;
  return labelYForRow(rowCount - 1) + LABEL_TEXT_HEIGHT_PX + ROW_GAP;
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

// The Year Axis's CSS tick gradients (and the scroll container's full-height
// decade gridlines) tile starting at x=0, i.e. at MIN_YEAR — which lines up
// with a real decade/century boundary only if MIN_YEAR itself is a multiple
// of that step. It happens to be for decades (MIN_YEAR is -2750, a multiple
// of 10) but not for centuries (-2750 isn't a multiple of 100), so each
// tier needs its own phase offset computed from MIN_YEAR rather than
// assuming 0 — this is that computation, done once at module load rather
// than per-render.
function phaseOffsetYears(stepYears: number): number {
  return Math.ceil(MIN_YEAR / stepYears) * stepYears - MIN_YEAR;
}
export const DECADE_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(DECADE_STEP_YEARS);
export const CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(CENTURY_STEP_YEARS);

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
// not-yet-laid-out first paint) — exported since TimelineCanvas's Year Axis
// viewport-windowing needs the same fallback before its own first measurement.
export const FALLBACK_VIEWPORT_WIDTH_PX = 1000;
// Extra years rendered on each side of the visible viewport for the Year
// Axis's decade/century ticks, as a fraction of viewport width — avoids
// ticks visibly popping in right at the scroll edge.
export const VIEWPORT_BUFFER_RATIO = 0.5;

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

/**
 * The active Fame Tier for a given visible-years count — a pure derivation
 * off FAME_TIER_YEAR_BOUNDS' contiguous bands, no separate stateful mode.
 * Boundary years belong to the denser (more zoomed-in) tier, so crossing a
 * threshold while zooming in immediately reveals that tier's wider dataset.
 */
export function fameTierForVisibleYears(visibleYears: number): FameTierName {
  if (visibleYears > FAME_TIER_YEAR_BOUNDS.NOTABLE.maxYears) return 'CORE';
  if (visibleYears > FAME_TIER_YEAR_BOUNDS.EXHAUSTIVE.maxYears) return 'NOTABLE';
  return 'EXHAUSTIVE';
}

/** fameTierForVisibleYears, from the same pixelsPerYear/viewportWidthPx pair zoomIn/zoomOut clamp against. */
export function fameTierForViewport(pixelsPerYear: number, viewportWidthPx: number): FameTierName {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return fameTierForVisibleYears(width / pixelsPerYear);
}
