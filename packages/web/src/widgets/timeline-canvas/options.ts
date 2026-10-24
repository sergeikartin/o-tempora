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
  type MilestoneCategory,
  POINT_LABEL_OFFSET_PX,
  POINT_RADIUS,
  wrapLabelLines,
  wrapMarkLabelLines,
} from '../../shared/types';

export {
  AVG_CHAR_WIDTH_PX,
  estimateLabelWidthPx,
  POINT_LABEL_OFFSET_PX,
  POINT_RADIUS,
  wrapLabelLines,
  wrapMarkLabelLines,
};

// Width of the margin strip at each lane's left edge that carries its caption
// (TimelineCanvas.module.css's .laneCaption); marks pass under it, and pinned
// labels keep clear of it.
export const LANE_CAPTION_GUTTER_PX = 18;

// Row layout shared by every lane's D3 rendering.
export const ROW_GAP = 8;
export const LANE_TOP_PADDING = 12;
// Year Axis: a ruler bar whose ticks are two layered CSS repeating gradients
// (decade/century), so cost stays flat however wide the scroll area is, plus a
// label row of decade numbers windowed to the viewport plus a buffer
// (VIEWPORT_BUFFER_RATIO).
export const DECADE_STEP_YEARS = 10;
export const QUARTER_CENTURY_STEP_YEARS = 25;
export const CENTURY_STEP_YEARS = 100;
export const RULER_HEIGHT = 20;
export const RULER_LABEL_ROW_HEIGHT = 18;
export const AXIS_HEIGHT = RULER_HEIGHT + RULER_LABEL_ROW_HEIGHT;
// Tick height as a % of RULER_HEIGHT, hanging from the ruler's top (taller =
// more prominent). Passed as CSS custom properties because the px spacing
// depends on zoom (`--decade-tick-px`/`--century-tick-px`).
export const DECADE_TICK_HEIGHT_PCT = 55;
export const CENTURY_TICK_HEIGHT_PCT = 100;
// Decade labels are skipped once a decade is too narrow to fit its text;
// century labels still show, spaced 10x further apart.
export const MIN_DECADE_LABEL_SPACING_PX = 40;
// The Minimap's century-tick strip (Minimap.tsx): ticks render across the full
// pannable range, but labels are thinned left to right, skipping any that
// would overlap the previous shown label's estimated width. Century labels
// vary in length ("1800s" vs. "8th century BCE"), so a flat spacing floor like
// the decade labels' isn't enough.
export const MINIMAP_CENTURY_STRIP_HEIGHT_PX = 20;

// A Period (Person lifespans, Conflict ranges) renders as a rounded-cap line;
// a PointInTime (ConflictEvents, Milestones) as a dot. Both use SVG stroke so
// `stroke-linecap: round` gives the caps.
export const PERIOD_LINE_HEIGHT = 6;
// Margin added on every side of a mark's bounds for its invisible hit-area
// rect: the thin line/dot is a poor target, and the gap to its label would be
// dead space.
export const HIT_AREA_PADDING_PX = 4;
// The selection/search-jump halo: a duplicate, wider <line> (see .lineHalo in
// PeopleLane and ConflictsMilestonesLane) or <circle> underneath the real mark,
// a translucent ink fill extending this many px past the grown mark.
export const SELECTION_HALO_PX = 8;
// A selected mark stays at its hover-grown size (a click is a hover that
// stuck). These mirror the numbers hardcoded in PeopleLane/
// ConflictsMilestonesLane's :hover CSS (CSS can't read
// PERIOD_LINE_HEIGHT/POINT_RADIUS) and size the halo to the grown mark.
export const SELECTED_LINE_HEIGHT_PX = 9;
export const SELECTED_POINT_RADIUS_PX = 7;
// Approx rendered height of an 11px label.
const LABEL_TEXT_HEIGHT_PX = 13;

// Row layout of the merged Conflicts+Milestones lane, where any item can land
// in any row (see ConflictsMilestonesLane.tsx). A range's label sits just
// below its line; every label is one line, so rows have a fixed pitch.
export const MILESTONES_MARKER_LABEL_GAP = 4;
export const MILESTONES_LABEL_LINE_HEIGHT_PX = LABEL_TEXT_HEIGHT_PX;

// A point's label block is vertically centered on its dot.
export function pointLabelY(markerY: number, lineCount: number): number {
  return markerY - ((lineCount - 1) * MILESTONES_LABEL_LINE_HEIGHT_PX) / 2;
}

export function pointHitY(markerY: number, lineCount: number): number {
  return (
    markerY -
    (lineCount * MILESTONES_LABEL_LINE_HEIGHT_PX) / 2 -
    HIT_AREA_PADDING_PX
  );
}

export function pointHitHeight(lineCount: number): number {
  return lineCount * MILESTONES_LABEL_LINE_HEIGHT_PX + HIT_AREA_PADDING_PX * 2;
}

// Above-line label layout, used by People: its Period bars stack into
// vertical bands, so label tier and band are the same "row", and a person's
// label sits just above their own line.
const PERSON_LABEL_GAP = 2;
// Vertical budget per row: label height + gap + lifespan line + breathing
// room to the next row.
export const PERSON_ROW_PITCH =
  LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT + ROW_GAP;

// Row 0 is the most famous row, and People wants it at the bottom, next to
// the shared Year Axis, so indices are inverted against rowCount: row 0 gets
// the highest y, row (rowCount - 1) sits at LANE_TOP_PADDING.

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

// Milestones' palette. MilestoneCategory keeps its 22 values for filtering
// and labels (disjoint from ConflictCategory), but color folds them into 2
// groups plus the flat Conflict color: 22 hues would be under 10° apart, below
// CVD-safe spacing. Each group is a darker step of the People-domain hue it
// echoes (Science & Innovation: Science & Technology; Society & Culture:
// Public Figures); see docs/design-tokens.md. MILESTONE_CATEGORY_GROUP_COLORS
// lives in shared/config because features/ can't import from widgets/.
//
// Derived from MILESTONE_CATEGORY_TO_GROUP (packages/shared-types) so the
// timeline's color and the Filters Panel can't drift apart: one hex per
// MilestoneCategory, 2 distinct hexes.
export const MILESTONE_CATEGORY_COLORS: Record<MilestoneCategory, string> =
  Object.fromEntries(
    Object.entries(MILESTONE_CATEGORY_TO_GROUP).map(([category, group]) => [
      category,
      MILESTONE_CATEGORY_GROUP_COLORS[group],
    ]),
  ) as Record<MilestoneCategory, string>;

export const MIN_YEAR = PAN_MIN_YEAR;

// The Year Axis's CSS tick gradients render as two adjacent regions split at
// year 0, a BCE ruler tiling from its own x=0 (= MIN_YEAR) and a CE ruler from
// x=0 (= year 0), each with an offset relative to its own origin. Round BCE
// tick years (format-year.ts's isRoundTickYear/roundTickYearsInRange: year ≡ 1
// mod stepYears, e.g. -9/-19 for "10 BCE"/"20 BCE") sit on a different phase
// than CE ticks and the year-0 boundary tick (≡ 0 mod stepYears); see
// docs/adr/0001-astronomical-year-numbering.md.
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
// Same round-year phase alignment at the 25-year zebra interval
// (TimelineCanvas.tsx's .zebraLayer).
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

const ZOOM_STEP = 0.2;
// Fallback width before the scroll container has been measured (jsdom, first
// paint); exported because TimelineCanvas's Year Axis windowing needs it too.
export const FALLBACK_VIEWPORT_WIDTH_PX = 1000;
// Extra years rendered on each side of the viewport for the Year Axis ticks,
// as a fraction of viewport width, so ticks don't pop in at the scroll edge.
export const VIEWPORT_BUFFER_RATIO = 0.5;

/**
 * Pixels-per-year bounds implied by ZOOM_MIN_YEARS/ZOOM_MAX_YEARS at a
 * given viewport width: `min` shows ZOOM_MAX_YEARS at once (zoomed all the
 * way out), `max` shows ZOOM_MIN_YEARS at once (zoomed all the way in).
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

// Breathing room around an Entity Link's spans, each side, as a fraction of
// their union.
const ARRIVAL_FIT_PADDING_RATIO = 0.1;

/**
 * Where an Entity Link's arrival puts the viewport: the union of the
 * Selection's spans plus padding, clamped to the zoom limits, sized to the
 * canvas minus the `coveredWidthPx` the detail drawer hides on its right.
 * `centerYear` is the year to center the whole canvas on so the union's
 * midpoint lands in the middle of the uncovered part.
 */
export function arrivalFitViewport(
  union: { startYear: number; endYear: number },
  canvasWidthPx: number,
  coveredWidthPx: number,
): { pixelsPerYear: number; centerYear: number } {
  const uncoveredWidthPx = Math.max(canvasWidthPx - coveredWidthPx, 1);
  const paddedYears =
    (union.endYear - union.startYear) * (1 + 2 * ARRIVAL_FIT_PADDING_RATIO);
  const visibleYears = Math.min(
    ZOOM_MAX_YEARS,
    Math.max(ZOOM_MIN_YEARS, paddedYears),
  );
  const pixelsPerYear = clampPixelsPerYear(
    uncoveredWidthPx / visibleYears,
    canvasWidthPx,
  );
  const midYear = (union.startYear + union.endYear) / 2;
  return {
    pixelsPerYear,
    centerYear: midYear + coveredWidthPx / 2 / pixelsPerYear,
  };
}

/** Initial zoom level: shows DEFAULT_VISIBLE_YEARS at once, on every viewport. */
export function defaultPixelsPerYear(viewportWidthPx: number): number {
  const width = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  return clampPixelsPerYear(width / DEFAULT_VISIBLE_YEARS, width);
}

// A fixed scale the Minimap packs its sparkline and century ticks against
// (web/docs/adr/0004-density-minimap-replaces-scrollbar.md); a curve computed
// at the live zoom would disagree with the canvas. Also the scale
// data-pipeline's row-assignment.ts packs each entry's permanent
// TimelineEntry.row against (docs/adr/0005-row-assignment-moves-to-the-pipeline.md)
// via shared-types' REFERENCE_SCALE_PIXELS_PER_YEAR, since data-pipeline doesn't
// depend on web. This stays a live defaultPixelsPerYear() so it follows
// DEFAULT_VISIBLE_YEARS/FALLBACK_VIEWPORT_WIDTH_PX; options.test.ts asserts the
// two agree.
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

// Pinch-to-zoom math as pure functions (like zoomIn/zoomOut above), so it is
// unit-testable without simulating multi-touch.

/**
 * Live pixelsPerYear for a pinch: the gesture's distance ratio applied to
 * the pixelsPerYear committed at gesture start, clamped by the button-zoom
 * bounds. No discrete step/snap.
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
 * The year under a pinch gesture's midpoint (scale.invert, as `zoom()`'s
 * centerYear does for the viewport center in TimelineCanvas.tsx).
 */
export function pinchCenterYear(
  scale: d3.ScaleLinear<number, number>,
  scrollLeft: number,
  midpointOffsetPx: number,
): number {
  return scale.invert(scrollLeft + midpointOffsetPx);
}

// Wheel zoom: one notch (a 100px delta) matches a button step; a trackpad
// pinch's small deltas scale proportionally. The per-event delta is clamped so
// a fast flick can't jump the whole range in one event.
const WHEEL_ZOOM_SENSITIVITY = 0.01;
const WHEEL_ZOOM_MAX_DELTA = 20;
const WHEEL_LINE_HEIGHT_PX = 16;

/** Pixel-equivalent delta of a wheel event, whatever its deltaMode. */
export function wheelDeltaPx(
  delta: number,
  deltaMode: number,
  pageSizePx: number,
): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_HEIGHT_PX;
  if (deltaMode === 2) return delta * pageSizePx;
  return delta;
}

/** Multiplier for pixelsPerYear from one wheel event: wheel up (negative deltaY) zooms in. */
export function wheelZoomFactor(deltaYPx: number): number {
  const clamped = Math.max(
    -WHEEL_ZOOM_MAX_DELTA,
    Math.min(WHEEL_ZOOM_MAX_DELTA, deltaYPx),
  );
  return Math.exp(-clamped * WHEEL_ZOOM_SENSITIVITY);
}

// Keyboard pan distance, as a fraction of the viewport width.
const KEY_PAN_RATIO = 0.1;
const KEY_PAN_LARGE_RATIO = 0.5;

export function keyPanStepPx(clientWidthPx: number, isLarge: boolean): number {
  return clientWidthPx * (isLarge ? KEY_PAN_LARGE_RATIO : KEY_PAN_RATIO);
}

// Drag inertia: the release velocity is read from the last
// INERTIA_VELOCITY_WINDOW_MS of pointer movement, then decays exponentially.
// A pause before release leaves no samples in the window, so the pan stops.
const INERTIA_VELOCITY_WINDOW_MS = 100;
const INERTIA_TIME_CONSTANT_MS = 325;
export const INERTIA_MIN_SPEED_PX_PER_MS = 0.02;

export interface DragSample {
  timeMs: number;
  x: number;
}

/** Pointer velocity (px/ms, signed) at release, from samples ordered by time. */
export function releaseVelocityPxPerMs(
  samples: readonly DragSample[],
  releaseTimeMs: number,
): number {
  const recent = samples.filter(
    (sample) => releaseTimeMs - sample.timeMs <= INERTIA_VELOCITY_WINDOW_MS,
  );
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.timeMs <= first.timeMs) return 0;
  return (last.x - first.x) / (last.timeMs - first.timeMs);
}

/** Exact distance travelled and remaining velocity after `dtMs` of decay, independent of frame rate. */
export function inertiaStep(
  velocityPxPerMs: number,
  dtMs: number,
): { distancePx: number; velocityPxPerMs: number } {
  const decay = Math.exp(-dtMs / INERTIA_TIME_CONSTANT_MS);
  return {
    distancePx: velocityPxPerMs * INERTIA_TIME_CONSTANT_MS * (1 - decay),
    velocityPxPerMs: velocityPxPerMs * decay,
  };
}

// Zoom animation: one `translate(tx) scale(sx)` group transform per lane/axis,
// driven by per-frame JS interpolation of pixelsPerYear. Per-mark attribute
// recompute costs 250-530ms/frame at worst-case density (16ms budget), and a
// CSS `transition` is unreliable through React's commit model. Every mark
// stays drawn at the start pixelsPerYear for the whole gesture and this
// transform makes them track the interpolated value; real state commits once
// at the end (TimelineCanvas.tsx).

export interface ZoomAnimationTransform {
  /** Horizontal translation, in the same px units as the content it's applied to. */
  tx: number;
  /** Horizontal-only scale (never applied to y — zoom never changes row layout). */
  sx: number;
}

/** Imperative per-tick hook a lane/axis component exposes to TimelineCanvas's single rAF driver. */
export interface ZoomAnimationHandle {
  applyZoomTransform: (transform: ZoomAnimationTransform) => void;
  /**
   * Called once at gesture start: promotes the animated group to its own
   * compositor layer before the first transform write, since a plain
   * imperative `style.transform` gets no automatic promotion from the
   * browser. The commit-time effect that resets `transform` to identity also
   * cleans this up.
   */
  beginZoomAnimation?: () => void;
}

/** The People lane's handle: the zoom hooks plus label pinning, driven from the scroll position. */
export interface PeopleLaneHandle extends ZoomAnimationHandle {
  pinLabelsToViewport: (scrollLeft: number) => void;
}

/**
 * The wrapping group's tx/sx mid-animation: marks are still drawn at
 * startPixelsPerYear, so this makes them appear at currentPixelsPerYear,
 * centered on centerYear (viewport center when the gesture began). The real
 * scrollLeft is held fixed and its eventual change is folded into tx, since
 * writing it mid-gesture races with scroll clamping.
 */
export function zoomAnimationGroupTransform(params: {
  startPixelsPerYear: number;
  currentPixelsPerYear: number;
  minYear: number;
  centerYear: number;
  scrollLeftStart: number;
  clientWidthPx: number;
  /** Where `centerYear` sits in the viewport; the middle unless a wheel zoom pins it under the cursor. */
  anchorOffsetPx?: number;
}): ZoomAnimationTransform {
  const {
    startPixelsPerYear,
    currentPixelsPerYear,
    minYear,
    centerYear,
    scrollLeftStart,
    clientWidthPx,
    anchorOffsetPx = clientWidthPx / 2,
  } = params;
  const sx =
    startPixelsPerYear !== 0 ? currentPixelsPerYear / startPixelsPerYear : 1;
  const scrollLeftTarget =
    (centerYear - minYear) * currentPixelsPerYear - anchorOffsetPx;
  return { tx: scrollLeftStart - scrollLeftTarget, sx };
}

/** SVG `transform` attribute value (unitless, SVG user-space) for a ZoomAnimationTransform. */
export function zoomAnimationGroupTransformAttr({
  tx,
  sx,
}: ZoomAnimationTransform): string {
  return `translate(${tx}, 0) scale(${sx}, 1)`;
}

/**
 * The year span the zoom animation shows at `currentPixelsPerYear`: it keeps
 * `centerYear` at the viewport centre (the same frame zoomAnimationGroupTransform
 * folds into its translation), so the Scrubber can follow it without a commit.
 */
export function zoomedViewportYears(
  centerYear: number,
  currentPixelsPerYear: number,
  clientWidthPx: number,
  anchorOffsetPx = clientWidthPx / 2,
): [startYear: number, endYear: number] {
  const startYear = centerYear - anchorOffsetPx / currentPixelsPerYear;
  return [startYear, startYear + clientWidthPx / currentPixelsPerYear];
}

/** CSS `transform` value (px units, HTML elements) for a ZoomAnimationTransform. */
export function zoomAnimationGroupTransformCss({
  tx,
  sx,
}: ZoomAnimationTransform): string {
  return `translateX(${tx}px) scaleX(${sx})`;
}

// A label/dot's counter-scale: negates the group's x-only scale so glyphs and
// circles don't stretch. A bare `scale(1/sx, 1)`: each label/dot's own CSS
// transform-origin (transform-box: fill-box, as the hover-scale uses; see
// PeopleLane's `.name`, ConflictsMilestonesLane's `.label`/`.dot`) pivots it at
// its natural anchor. Computed fresh from sx each tick, so it is exact, unlike
// a CSS custom-property reciprocal transition.
export function zoomAnimationCounterScaleAttr(groupSx: number): string {
  const inverse = groupSx !== 0 ? 1 / groupSx : 1;
  return `scale(${inverse}, 1)`;
}

export function zoomAnimationCounterScaleCss(groupSx: number): string {
  const inverse = groupSx !== 0 ? 1 / groupSx : 1;
  return `scaleX(${inverse})`;
}

// Zoom animation target duration (300-400ms, longer than
// --motion-duration-base). Scaling the live token collapses it to near-zero
// under prefers-reduced-motion like all other motion.
export const ZOOM_ANIMATION_DURATION_MULTIPLIER = 1.75;

export function zoomAnimationDurationMs(baseDurationMs: number): number {
  return baseDurationMs * ZOOM_ANIMATION_DURATION_MULTIPLIER;
}
