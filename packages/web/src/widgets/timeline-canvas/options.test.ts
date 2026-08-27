import { expect, test } from 'vitest';
import {
  CONFLICT_COLOR,
  DOMAIN_COLORS,
  MILESTONE_CATEGORY_GROUP_COLORS,
  PAN_MIN_YEAR,
  ZOOM_MAX_YEARS,
  ZOOM_MIN_YEARS,
} from '../../shared/config';
import { today } from '../../shared/lib/date';
import {
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_GROUPS,
  MILESTONE_CATEGORY_TO_GROUP,
  OCCUPATION_DOMAINS,
  REFERENCE_SCALE_PIXELS_PER_YEAR,
} from '../../shared/types';
import {
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  buildXScale,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  clampPixelsPerYear,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  defaultPixelsPerYear,
  MILESTONE_CATEGORY_COLORS,
  pinchCenterYear,
  pinchPixelsPerYear,
  pixelsPerYearBounds,
  REFERENCE_PIXELS_PER_YEAR,
  ZOOM_ANIMATION_DURATION_MULTIPLIER,
  zoomAnimationCounterScaleAttr,
  zoomAnimationCounterScaleCss,
  zoomAnimationDurationMs,
  zoomAnimationGroupTransform,
  zoomAnimationGroupTransformAttr,
  zoomAnimationGroupTransformCss,
  zoomIn,
  zoomOut,
} from './options';

test('buildXScale domains from PAN_MIN_YEAR to a live today() read', () => {
  const { scale } = buildXScale(5);
  const [minYear, maxYear] = scale.domain();
  expect(minYear).toBe(PAN_MIN_YEAR);
  expect(maxYear).toBe(today());
});

test('buildXScale sizes totalWidth as totalYears * pixelsPerYear', () => {
  const pixelsPerYear = 5;
  const { scale, totalWidth } = buildXScale(pixelsPerYear);
  const totalYears = today() - PAN_MIN_YEAR;
  expect(totalWidth).toBe(totalYears * pixelsPerYear);
  expect(scale.range()).toEqual([0, totalWidth]);
});

test('REFERENCE_PIXELS_PER_YEAR matches shared-types REFERENCE_SCALE_PIXELS_PER_YEAR', () => {
  // data-pipeline's row-assignment.ts imports the shared constant directly;
  // this side derives the same number live via defaultPixelsPerYear() so it
  // keeps auto-following DEFAULT_VISIBLE_YEARS/FALLBACK_VIEWPORT_WIDTH_PX.
  // If a future change to either moves this value without updating the
  // shared constant, this assertion catches the drift instead of the
  // pipeline and the Minimap silently disagreeing on Row Depth.
  expect(REFERENCE_PIXELS_PER_YEAR).toBe(REFERENCE_SCALE_PIXELS_PER_YEAR);
});

function trueMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

test("DECADE/CENTURY_TICK_PHASE_OFFSET_YEARS align the CE ruler's own local origin (year 0) + offset to a plain multiple of the step", () => {
  // The CE ruler's local x=0 is astronomical year 0, not MIN_YEAR (YearAxis.tsx
  // splits the ruler into two independently-tiled regions) — so this offset
  // must land ticks on round numbers measured from year 0, not from MIN_YEAR.
  expect(trueMod(0 + DECADE_TICK_PHASE_OFFSET_YEARS, DECADE_STEP_YEARS)).toBe(
    0,
  );
  expect(trueMod(0 + CENTURY_TICK_PHASE_OFFSET_YEARS, CENTURY_STEP_YEARS)).toBe(
    0,
  );
});

test('BCE_DECADE/CENTURY_TICK_PHASE_OFFSET_YEARS align MIN_YEAR + offset to the round-historical BCE phase (year ≡ 1 mod step)', () => {
  // This is the phase format-year.ts's isRoundTickYear/roundTickYearsInRange
  // put BCE ticks on (e.g. -9, -19 for "10 BCE"/"20 BCE") — distinct from
  // the plain 0-phase CE grid above.
  expect(
    trueMod(
      PAN_MIN_YEAR + BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
      DECADE_STEP_YEARS,
    ),
  ).toBe(1);
  expect(
    trueMod(
      PAN_MIN_YEAR + BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
      CENTURY_STEP_YEARS,
    ),
  ).toBe(1);
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

test('defaultPixelsPerYear targets the default 120-year (1740-1860) viewport width, on every viewport', () => {
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

test('pinchPixelsPerYear scales startPixelsPerYear by the live distance ratio', () => {
  expect(pinchPixelsPerYear(10, 100, 150, 1000)).toBeCloseTo(15); // fingers spread 1.5x -> zoom in 1.5x
  expect(pinchPixelsPerYear(10, 100, 50, 1000)).toBeCloseTo(5); // fingers pinched to 0.5x -> zoom out 0.5x
});

test('pinchPixelsPerYear clamps the result to the same bounds as zoomIn/zoomOut', () => {
  expect(pinchPixelsPerYear(1000, 100, 1000, 1000)).toBe(1000 / ZOOM_MIN_YEARS);
  expect(pinchPixelsPerYear(0.1, 100, 1, 1000)).toBe(1000 / ZOOM_MAX_YEARS);
});

test('pinchPixelsPerYear falls back to a 1x ratio rather than dividing by a zero start distance', () => {
  expect(pinchPixelsPerYear(10, 0, 150, 1000)).toBe(10);
});

test('pinchCenterYear resolves the year at a midpoint offset the same way zoom() resolves its viewport-center year', () => {
  const { scale } = buildXScale(5);
  const scrollLeft = 200;
  const midpointOffsetPx = 50;
  expect(pinchCenterYear(scale, scrollLeft, midpointOffsetPx)).toBeCloseTo(
    scale.invert(scrollLeft + midpointOffsetPx),
  );
});

test('DOMAIN_COLORS has one entry per OccupationDomain, no duplicate hex values', () => {
  const values = OCCUPATION_DOMAINS.map((domain) => DOMAIN_COLORS[domain]);
  expect(values).toHaveLength(OCCUPATION_DOMAINS.length);
  expect(values.every(Boolean)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});

test('CONFLICT_COLOR is a single flat color, distinct from every MILESTONE_CATEGORY_COLORS hue', () => {
  const milestoneValues = MILESTONE_CATEGORIES.map(
    (category) => MILESTONE_CATEGORY_COLORS[category],
  );
  expect(CONFLICT_COLOR).toBeTruthy();
  expect(milestoneValues).not.toContain(CONFLICT_COLOR);
});

test('MILESTONE_CATEGORY_COLORS has one entry per MilestoneCategory, folded into exactly 2 group hexes', () => {
  const values = MILESTONE_CATEGORIES.map(
    (category) => MILESTONE_CATEGORY_COLORS[category],
  );
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
    expect(MILESTONE_CATEGORY_COLORS[category]).toBe(
      MILESTONE_CATEGORY_GROUP_COLORS[group],
    );
  }
});

test('MILESTONE_CATEGORY_TO_GROUP covers every MilestoneCategory, resolving to exactly one of the 2 groups', () => {
  for (const category of MILESTONE_CATEGORIES) {
    expect(MILESTONE_CATEGORY_GROUPS).toContain(
      MILESTONE_CATEGORY_TO_GROUP[category],
    );
  }
  const coveredCategories = new Set(Object.keys(MILESTONE_CATEGORY_TO_GROUP));
  expect(coveredCategories.size).toBe(MILESTONE_CATEGORIES.length);
});

test('zoomAnimationGroupTransform: sx is the ratio of current to start pixelsPerYear', () => {
  const { sx } = zoomAnimationGroupTransform({
    startPixelsPerYear: 10,
    currentPixelsPerYear: 15,
    minYear: 0,
    centerYear: 100,
    scrollLeftStart: 0,
    clientWidthPx: 1000,
  });
  expect(sx).toBe(1.5);
});

test('zoomAnimationGroupTransform: sx falls back to 1 rather than dividing by a zero start pixelsPerYear', () => {
  const { sx } = zoomAnimationGroupTransform({
    startPixelsPerYear: 0,
    currentPixelsPerYear: 15,
    minYear: 0,
    centerYear: 100,
    scrollLeftStart: 0,
    clientWidthPx: 1000,
  });
  expect(sx).toBe(1);
});

test('zoomAnimationGroupTransform: at currentPixelsPerYear === startPixelsPerYear (t=0), tx/sx is the identity transform relative to the held-fixed scrollLeft', () => {
  // At the very start of an animation the DOM's real geometry (still drawn
  // at startPixelsPerYear) and centerYear/scrollLeftStart were captured
  // from the same, currently-on-screen state — so the transform this
  // instant produces must be a no-op, or every zoom would flash on the
  // first frame. scrollLeftStart is derived the same way zoom() itself
  // derives centerYear from it (scale.invert(scrollLeft + clientWidth/2)),
  // just inverted — an arbitrary, unrelated scrollLeftStart wouldn't
  // satisfy the invariant this is checking.
  const minYear = -800;
  const centerYear = 1800;
  const clientWidthPx = 1000;
  const startPixelsPerYear = 8;
  const scrollLeftStart =
    (centerYear - minYear) * startPixelsPerYear - clientWidthPx / 2;
  const transform = zoomAnimationGroupTransform({
    startPixelsPerYear,
    currentPixelsPerYear: startPixelsPerYear,
    minYear,
    centerYear,
    scrollLeftStart,
    clientWidthPx,
  });
  expect(transform.sx).toBe(1);
  expect(transform.tx).toBeCloseTo(0);
});

test('zoomAnimationGroupTransform: tx re-centers on centerYear at viewport center for the interpolated pixelsPerYear', () => {
  // year(centerYear) at currentPixelsPerYear, transformed by tx/sx, must
  // land exactly at clientWidthPx / 2 — the same "centered in the
  // viewport" invariant the non-animated zoom() already guarantees today.
  const minYear = -800;
  const centerYear = 1800;
  const clientWidthPx = 1000;
  const startPixelsPerYear = 8;
  const currentPixelsPerYear = 9.6;
  const scrollLeftStart =
    (centerYear - minYear) * startPixelsPerYear - clientWidthPx / 2;
  const { tx, sx } = zoomAnimationGroupTransform({
    startPixelsPerYear,
    currentPixelsPerYear,
    minYear,
    centerYear,
    scrollLeftStart,
    clientWidthPx,
  });
  const domX = (centerYear - minYear) * startPixelsPerYear; // where centerYear is actually drawn right now
  const onScreenX = domX * sx + tx - scrollLeftStart; // domX under this transform, minus the (held-fixed) real scrollLeft
  expect(onScreenX).toBeCloseTo(clientWidthPx / 2);
});

test('zoomAnimationGroupTransformAttr renders an SVG translate/scale (unitless, x-only) transform', () => {
  expect(zoomAnimationGroupTransformAttr({ tx: 12, sx: 1.5 })).toBe(
    'translate(12, 0) scale(1.5, 1)',
  );
});

test('zoomAnimationGroupTransformCss renders a CSS translateX/scaleX (px, x-only) transform', () => {
  expect(zoomAnimationGroupTransformCss({ tx: 12, sx: 1.5 })).toBe(
    'translateX(12px) scaleX(1.5)',
  );
});

test('zoomAnimationCounterScaleAttr negates the group sx exactly (x-only)', () => {
  expect(zoomAnimationCounterScaleAttr(1.5)).toBe(`scale(${1 / 1.5}, 1)`);
});

test('zoomAnimationCounterScaleCss negates the group sx exactly (x-only)', () => {
  expect(zoomAnimationCounterScaleCss(1.5)).toBe(`scaleX(${1 / 1.5})`);
});

test('zoomAnimationCounterScaleAttr/Css fall back to 1 rather than dividing by a zero sx', () => {
  expect(zoomAnimationCounterScaleAttr(0)).toBe('scale(1, 1)');
  expect(zoomAnimationCounterScaleCss(0)).toBe('scaleX(1)');
});

test('zoomAnimationDurationMs scales a base duration by ZOOM_ANIMATION_DURATION_MULTIPLIER, so it collapses to near-zero under prefers-reduced-motion automatically', () => {
  expect(zoomAnimationDurationMs(200)).toBe(
    200 * ZOOM_ANIMATION_DURATION_MULTIPLIER,
  );
  expect(zoomAnimationDurationMs(0.01)).toBeCloseTo(
    0.01 * ZOOM_ANIMATION_DURATION_MULTIPLIER,
  );
});

test('the zoom-button animation targets longer than --motion-duration-base (200ms), within the spec-called-for 300-400ms range', () => {
  const durationMs = zoomAnimationDurationMs(200);
  expect(durationMs).toBeGreaterThan(200);
  expect(durationMs).toBeGreaterThanOrEqual(300);
  expect(durationMs).toBeLessThanOrEqual(400);
});
