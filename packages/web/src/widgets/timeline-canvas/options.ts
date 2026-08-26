import * as d3 from 'd3';
import {
  DEFAULT_VIEWPORT_END_YEAR,
  DEFAULT_VIEWPORT_START_YEAR,
  MILESTONE_CATEGORY_GROUP_COLORS,
  PAN_MIN_YEAR,
  ZOOM_MAX_YEARS,
  ZOOM_MIN_YEARS,
} from '../../shared/config';
import { today } from '../../shared/lib/date';
import {
  AVG_CHAR_WIDTH_PX,
  estimateLabelWidthPx,
  MILESTONE_CATEGORY_TO_GROUP,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  type MilestoneCategory,
  POINT_RADIUS,
  wrapLabelLines,
} from '../../shared/types';

export {
  AVG_CHAR_WIDTH_PX,
  estimateLabelWidthPx,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  POINT_RADIUS,
  wrapLabelLines,
};

// Row layout shared by every lane's D3 rendering.
export const ROW_GAP = 8;
export const LANE_TOP_PADDING = 12;
// Year Axis: a ruler bar whose tick marks are pure CSS (two layered
// repeating background-gradients — decade/century — no per-tick DOM
// node, so its cost is ~flat regardless of the scrollable width) plus a
// label row below showing decade numbers as plain positioned elements,
// windowed to the visible viewport (+ buffer — see TimelineCanvas's
// VIEWPORT_BUFFER_RATIO). Replaces an earlier design that generated one DOM
// node per tick (first via d3's adaptive axisBottom, later a fixed-step D3
// join) — sizing tick count off the entire scrollable width regardless of
// scroll position was the single biggest contributor to initial-load time;
// the CSS-gradient approach sidesteps that per-tick cost entirely rather
// than just windowing it.
export const DECADE_STEP_YEARS = 10;
export const QUARTER_CENTURY_STEP_YEARS = 25;
export const CENTURY_STEP_YEARS = 100;
export const RULER_HEIGHT = 20;
export const RULER_LABEL_ROW_HEIGHT = 18;
export const AXIS_HEIGHT = RULER_HEIGHT + RULER_LABEL_ROW_HEIGHT;
// Tick height as a % of RULER_HEIGHT, top-anchored (a tick "hangs down"
// from the top of the ruler bar, taller = more prominent) — passed as CSS
// custom properties rather than baked into the CSS Module since the
// underlying px spacing is zoom-dependent (see TimelineCanvas's
// `--decade-tick-px`/`--century-tick-px` custom properties).
export const DECADE_TICK_HEIGHT_PCT = 55;
export const CENTURY_TICK_HEIGHT_PCT = 100;
// Decade labels are skipped once zoomed out far enough that a decade's
// pixel width would make the year text collide with its neighbor's —
// century labels are still shown, spaced 10x further apart.
export const MIN_DECADE_LABEL_SPACING_PX = 40;
// The Minimap's top-edge century-tick strip (Minimap.tsx): ticks always
// render across the full pannable range, but labels are thinned by walking
// left to right and skipping any that would overlap the previous shown
// label's own estimated rendered width — unlike YearAxis's decade labels
// (uniform spacing at any given zoom, so a single show/hide toggle against a
// flat px floor works), century labels vary a lot in text length ("1800s"
// vs. "8th century BCE"), so a flat floor alone still let long labels
// visually overlap the next tick's short one.
export const MINIMAP_CENTURY_STRIP_HEIGHT_PX = 20;

// A Period (a real duration — Person lifespans, Conflict ranges) always
// renders as a rounded-cap line; a PointInTime
// (ConflictEvents, Milestones) always renders as a dot. Both are drawn
// with SVG stroke, not fill, so `stroke-linecap: round` gives the
// pill-shaped caps.
export const PERIOD_LINE_HEIGHT = 6;
// Extra margin (in every direction) added around a mark's own visible
// bounds for its invisible hit-area rect — the thin 6px line/5px dot alone
// is a poor hover/click target, and a mark's label sits a few px above/below
// it with a gap that would otherwise be dead space between two separately
// clickable elements.
export const HIT_AREA_PADDING_PX = 4;
// The search-jump/selection ring drawn around a Period line (a duplicate,
// wider <line> underneath the real one, not a filter — see PeopleLane and
// ConflictsMilestonesLane's .lineRingOuter/.lineRingGap) or around a point's
// dot (a duplicate, wider <circle>). SELECTION_RING_GAP_PX is a parchment
// band between the mark's own color and the ring, so the two never blend
// into each other; SELECTION_RING_WIDTH_PX is the ring's own thickness.
export const SELECTION_RING_GAP_PX = 2;
export const SELECTION_RING_WIDTH_PX = 2;
// A selected mark renders permanently at its hover-grown size (not just the
// resting PERIOD_LINE_HEIGHT/POINT_RADIUS) — a click is a hover that stuck,
// so selecting shouldn't itself trigger a further size change. These mirror
// the same two numbers PeopleLane/ConflictsMilestonesLane's own :hover CSS
// rules hardcode (CSS can't read PERIOD_LINE_HEIGHT/POINT_RADIUS either),
// and size the selection ring's own thickness so it tracks the grown mark
// rather than the resting one.
export const SELECTED_LINE_HEIGHT_PX = 9;
export const SELECTED_POINT_RADIUS_PX = 7;
// Approx rendered height of an 11px label.
const LABEL_TEXT_HEIGHT_PX = 13;

// Below-marker label layout, shared by the merged Conflicts+Milestones lane
// for every item it stacks — range lines, Conflict point dots, and
// Milestone point dots alike — since a single shared row-packing pass means
// any of them can land in any row (see ConflictsMilestonesLane.tsx). A
// row's marker and label move down together, the label sitting just below
// its own marker, same as People's above-line treatment but flipped. Row
// height is computed per-render from the tallest label actually assigned to
// that row (a Milestone's label can wrap across multiple lines via
// wrapLabelLines above; Conflicts' labels are always one line), not a fixed
// pitch — see ConflictsMilestonesLane.tsx's row-height computation.
export const MILESTONES_MARKER_LABEL_GAP = 4;
export const MILESTONES_LABEL_LINE_HEIGHT_PX = LABEL_TEXT_HEIGHT_PX;

// Above-line label layout, used by People — the one lane whose Period bars
// don't all share a fixed marker y (they stack into vertical bands like a
// Gantt chart), so unlike the below-marker lane above, the label tier and
// the vertical band are the same "row" concept: a person's label sits just
// above their own lifespan line, both moving together per row.
const PERSON_LABEL_GAP = 2;
// Vertical budget per row: label height + gap + lifespan line + breathing
// room to the next row.
export const PERSON_ROW_PITCH =
  LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT + ROW_GAP;

// assignRows hands back row 0 as the most-famous-heavy row (see its own
// comment), and the People lane wants that row closest to the bottom of its
// box — the edge next to the shared Year Axis below it — so row indices are
// inverted against rowCount here: row 0 lands at the highest y (bottom),
// row (rowCount - 1) at LANE_TOP_PADDING (top, furthest from the axis).

/** y of a row's label — hangs just above that row's lifespan line. */
export function personLabelYForRow(row: number, rowCount: number): number {
  return LANE_TOP_PADDING + (rowCount - 1 - row) * PERSON_ROW_PITCH;
}

/** y (vertical center) of a row's lifespan line. */
export function personLineCenterYForRow(row: number, rowCount: number): number {
  return (
    personLabelYForRow(row, rowCount) +
    LABEL_TEXT_HEIGHT_PX +
    PERSON_LABEL_GAP +
    PERIOD_LINE_HEIGHT / 2
  );
}

/** Total SVG height needed for the People lane with this many stacked rows. */
export function personLaneHeight(rowCount: number): number {
  if (rowCount === 0) return LANE_TOP_PADDING * 2;
  return LANE_TOP_PADDING + rowCount * PERSON_ROW_PITCH;
}

// Milestones' own palette. MilestoneCategory keeps its full 22-value
// taxonomy for filtering/labels (disjoint from Conflicts' ConflictCategory,
// which no longer drives a color — see CONFLICT_COLOR above), but color
// folds every category into 2 legible groups plus the flat Conflict red —
// a 22-hue-per-category palette sits at well under 10° hue separation, below any
// CVD-safe spacing and more colors than a legend can hold anyway. Each
// group rhymes with (is a darker, richer step of) the People-domain hue its
// content actually echoes, so the color language is learned once: Science &
// Innovation deepens Science & Technology, Social & Human Culture deepens
// Public Figure. See docs/design-tokens.md for the validation report and
// the full category -> group mapping. MILESTONE_CATEGORY_GROUP_COLORS
// itself lives in shared/config (imported above), not here, since the
// sidebar's Milestone Category Group filter pills need it too and
// features/ can't import from widgets/ under mini-FSD's layer rule — see
// that file's own comment.
//
// Derived from MILESTONE_CATEGORY_TO_GROUP (packages/shared-types) rather
// than listing per-category hexes directly, so the timeline's color and the
// sidebar's Milestone Category Group filter can never silently drift apart
// — public shape and values are unchanged (still one hex per
// MilestoneCategory, still exactly 2 distinct hexes).
export const MILESTONE_CATEGORY_COLORS: Record<MilestoneCategory, string> =
  Object.fromEntries(
    Object.entries(MILESTONE_CATEGORY_TO_GROUP).map(([category, group]) => [
      category,
      MILESTONE_CATEGORY_GROUP_COLORS[group],
    ]),
  ) as Record<MilestoneCategory, string>;

export const MIN_YEAR = PAN_MIN_YEAR;

// The Year Axis's CSS tick gradients (and the scroll container's full-height
// decade gridlines) render as two adjacent regions split at year 0 — a BCE
// ruler tiling from its own x=0 (= MIN_YEAR) and a CE ruler tiling from its
// own x=0 (= year 0), each needing an offset computed relative to *its own*
// local origin, not the other's. Round-historical BCE tick positions
// (format-year.ts's isRoundTickYear/roundTickYearsInRange — year ≡ 1 mod
// stepYears, e.g. -9/-19 for "10 BCE"/"20 BCE") also sit on a different
// phase than CE ticks and the era-boundary tick at year 0 (ordinary ≡ 0 mod
// stepYears, unchanged) — see docs/adr/0001-astronomical-year-numbering.md.
function phaseOffsetYears(
  stepYears: number,
  anchorRemainder: number,
  originYear: number,
): number {
  const raw = (anchorRemainder - originYear) % stepYears;
  return ((raw % stepYears) + stepYears) % stepYears;
}
export const DECADE_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  DECADE_STEP_YEARS,
  0,
  0,
);
export const CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  CENTURY_STEP_YEARS,
  0,
  0,
);
export const BCE_DECADE_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  DECADE_STEP_YEARS,
  1,
  MIN_YEAR,
);
export const BCE_CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  CENTURY_STEP_YEARS,
  1,
  MIN_YEAR,
);
// Same round-year phase alignment, at the lane background's 25-year zebra-
// band interval (TimelineCanvas.tsx's .zebraLayer) — replaces the old
// decade-interval gridlines (`/grill-with-docs`).
export const QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  QUARTER_CENTURY_STEP_YEARS,
  0,
  0,
);
export const BCE_QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(
  QUARTER_CENTURY_STEP_YEARS,
  1,
  MIN_YEAR,
);

/** Shared time domain: the D3 x-axis for every lane, keyed by pixels-per-year zoom level. */
export function buildXScale(pixelsPerYear: number): {
  scale: d3.ScaleLinear<number, number>;
  totalWidth: number;
} {
  const maxYear = today();
  const totalYears = maxYear - MIN_YEAR;
  const totalWidth = totalYears * pixelsPerYear;
  const scale = d3
    .scaleLinear()
    .domain([MIN_YEAR, maxYear])
    .range([0, totalWidth]);
  return { scale, totalWidth };
}

export const DEFAULT_VISIBLE_YEARS =
  DEFAULT_VIEWPORT_END_YEAR - DEFAULT_VIEWPORT_START_YEAR;
// A narrower first-paint window for phone-width viewports — without this,
// a narrow screen would render the same DEFAULT_VISIBLE_YEARS span as
// desktop, just smaller and denser, rather than genuinely more zoomed in.
export const MOBILE_DEFAULT_VISIBLE_YEARS = 50;

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
export function pixelsPerYearBounds(viewportWidthPx: number): {
  min: number;
  max: number;
} {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return { min: width / ZOOM_MAX_YEARS, max: width / ZOOM_MIN_YEARS };
}

export function clampPixelsPerYear(
  pixelsPerYear: number,
  viewportWidthPx: number,
): number {
  const { min, max } = pixelsPerYearBounds(viewportWidthPx);
  return Math.min(max, Math.max(min, pixelsPerYear));
}

/** Initial zoom level: shows `visibleYears` (DEFAULT_VISIBLE_YEARS unless overridden, e.g. by MOBILE_DEFAULT_VISIBLE_YEARS) at once. */
export function defaultPixelsPerYear(
  viewportWidthPx: number,
  visibleYears: number = DEFAULT_VISIBLE_YEARS,
): number {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return clampPixelsPerYear(width / visibleYears, width);
}

// A fixed scale (not the live viewport's, not the live zoom's) the Minimap
// packs its area-sparkline and century ticks against (Minimap.tsx,
// packages/web/docs/adr/0004-density-minimap-replaces-scrollbar.md) — a
// Row Depth curve computed at the live zoom would disagree with what the
// canvas actually renders as the user zooms. Also the exact scale
// data-pipeline's row-assignment.ts packs each entry's permanent
// TimelineEntry.row against (docs/adr/0005-row-assignment-moves-to-the-
// pipeline.md), imported there as shared-types' REFERENCE_SCALE_PIXELS_PER_YEAR
// rather than re-derived, since packages/data-pipeline doesn't depend on
// packages/web. This export stays a live defaultPixelsPerYear() call rather
// than importing that same shared constant, so it keeps auto-following
// DEFAULT_VISIBLE_YEARS/FALLBACK_VIEWPORT_WIDTH_PX if either ever changes;
// options.test.ts asserts the two values still agree.
export const REFERENCE_PIXELS_PER_YEAR = defaultPixelsPerYear(
  FALLBACK_VIEWPORT_WIDTH_PX,
);

export function zoomIn(pixelsPerYear: number, viewportWidthPx: number): number {
  return clampPixelsPerYear(pixelsPerYear * (1 + ZOOM_STEP), viewportWidthPx);
}

export function zoomOut(
  pixelsPerYear: number,
  viewportWidthPx: number,
): number {
  return clampPixelsPerYear(pixelsPerYear / (1 + ZOOM_STEP), viewportWidthPx);
}

// Pinch-to-zoom math, extracted as pure functions (mirroring zoomIn/zoomOut
// above) so the gesture's core arithmetic is unit-testable without
// simulating real multi-touch pointer events.

/**
 * Live pixelsPerYear implied by a pinch gesture's current two-point
 * distance relative to where the gesture started — the gesture's own
 * distance ratio applied to the pixelsPerYear committed at gesture start,
 * clamped by the same bounds button-zoom uses. No discrete step/snap: a
 * pinch's "minimal, no momentum" behavior is this ratio committing as-is.
 */
export function pinchPixelsPerYear(
  startPixelsPerYear: number,
  startDistancePx: number,
  currentDistancePx: number,
  viewportWidthPx: number,
): number {
  const distanceRatio =
    startDistancePx > 0 ? currentDistancePx / startDistancePx : 1;
  return clampPixelsPerYear(
    startPixelsPerYear * distanceRatio,
    viewportWidthPx,
  );
}

/**
 * The year under a pinch gesture's midpoint — same scale.invert technique
 * `zoom()`'s centerYear uses for the viewport's center (TimelineCanvas.tsx),
 * just anchored to the pinch midpoint's offset within the viewport instead.
 */
export function pinchCenterYear(
  scale: d3.ScaleLinear<number, number>,
  scrollLeft: number,
  midpointOffsetPx: number,
): number {
  return scale.invert(scrollLeft + midpointOffsetPx);
}

// Zoom-button animation: a single `translate(tx) scale(sx)` group transform
// per lane/axis, driven by a per-frame JS interpolation of pixelsPerYear —
// not per-mark attribute recompute (benchmarked at 250-530ms/frame at this
// app's worst-case density, 15-30x over the 16ms frame budget) and not a CSS
// `transition` (confirmed unreliable through React's commit model — see
// .scratch/zoom-filter-transitions/spec.md's post-mortem). Every mark stays
// drawn at the animation's start pixelsPerYear for the whole gesture (the
// real pixelsPerYear/scrollLeft state commits exactly once, at the end —
// TimelineCanvas.tsx) — this transform is what makes them visually track
// the interpolated value each tick instead.

export interface ZoomAnimationTransform {
  /** Horizontal translation, in the same px units as the content it's applied to. */
  tx: number;
  /** Horizontal-only scale (never applied to y — zoom never changes row layout). */
  sx: number;
}

/** Imperative per-tick hook a lane/axis component exposes to TimelineCanvas's single rAF driver. */
export interface ZoomAnimationHandle {
  applyZoomTransform: (transform: ZoomAnimationTransform) => void;
}

/**
 * The wrapping group's tx/sx mid-zoom-animation: marks are still drawn at
 * startPixelsPerYear (the DOM hasn't re-laid-out to the new scale yet), so
 * this is what makes them appear at currentPixelsPerYear instead, centered
 * on centerYear (the year at viewport center when the gesture began), with
 * the real scrollLeft held fixed for the whole animation — its own eventual
 * change is folded into tx here instead of ever being written mid-gesture
 * (the scroll-clamp race this app's zoom-animation history warns about).
 */
export function zoomAnimationGroupTransform(params: {
  startPixelsPerYear: number;
  currentPixelsPerYear: number;
  minYear: number;
  centerYear: number;
  scrollLeftStart: number;
  clientWidthPx: number;
}): ZoomAnimationTransform {
  const {
    startPixelsPerYear,
    currentPixelsPerYear,
    minYear,
    centerYear,
    scrollLeftStart,
    clientWidthPx,
  } = params;
  const sx =
    startPixelsPerYear !== 0 ? currentPixelsPerYear / startPixelsPerYear : 1;
  const scrollLeftTarget =
    (centerYear - minYear) * currentPixelsPerYear - clientWidthPx / 2;
  return { tx: scrollLeftStart - scrollLeftTarget, sx };
}

/** SVG `transform` attribute value (unitless, SVG user-space) for a ZoomAnimationTransform. */
export function zoomAnimationGroupTransformAttr({
  tx,
  sx,
}: ZoomAnimationTransform): string {
  return `translate(${tx}, 0) scale(${sx}, 1)`;
}

/** CSS `transform` value (px units, HTML elements) for a ZoomAnimationTransform. */
export function zoomAnimationGroupTransformCss({
  tx,
  sx,
}: ZoomAnimationTransform): string {
  return `translateX(${tx}px) scaleX(${sx})`;
}

// A label/dot's own shape-preserving counter-scale — negates the wrapping
// group's x-only scale so glyphs/circles don't stretch into ellipses (Key
// Gotcha #5). Deliberately just a bare `scale(1/sx, 1)`, not a
// translate/anchor composition: each label/dot's own transform-origin
// (already set in its .module.css, reusing the same transform-box: fill-box
// pattern the existing hover-scale relies on — PeopleLane's `.name`,
// ConflictsMilestonesLane's `.label`/`.dot`) pivots it at its own natural
// anchor point for free, so no per-item anchor coordinate needs threading
// through here. Computed fresh from the same sx every tick, so — unlike a
// CSS custom-property reciprocal transition — it's always exact, never an
// approximation of `eased(1/target)`.
export function zoomAnimationCounterScaleAttr(groupSx: number): string {
  const inverse = groupSx !== 0 ? 1 / groupSx : 1;
  return `scale(${inverse}, 1)`;
}

export function zoomAnimationCounterScaleCss(groupSx: number): string {
  const inverse = groupSx !== 0 ? 1 / groupSx : 1;
  return `scaleX(${inverse})`;
}

// Target duration for the zoom-button animation — longer than
// --motion-duration-base (200ms) per the spec, tuned within the 300-400ms
// range it calls for. Scaling the live token (rather than a bare literal)
// means this collapses to near-zero automatically under
// prefers-reduced-motion, exactly like every other motion in the app.
export const ZOOM_ANIMATION_DURATION_MULTIPLIER = 1.75;

export function zoomAnimationDurationMs(baseDurationMs: number): number {
  return baseDurationMs * ZOOM_ANIMATION_DURATION_MULTIPLIER;
}
