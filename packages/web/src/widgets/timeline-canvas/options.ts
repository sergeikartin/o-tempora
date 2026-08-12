import * as d3 from 'd3';
import { today } from '../../shared/lib/dates';
import {
  ZOOM_MIN_YEARS,
  ZOOM_MAX_YEARS,
  DEFAULT_VIEWPORT_START,
  DEFAULT_VIEWPORT_END,
  PAN_MIN_DATE,
  MILESTONE_CATEGORY_GROUP_COLORS,
} from '../../shared/config';
import { MILESTONE_CATEGORY_TO_GROUP, type MilestoneCategory } from '../../shared/types';

// Row layout shared by every lane's D3 rendering.
export const ROW_GAP = 8;
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
export const POINT_RADIUS = 5;
// Minimum gap (in scroll years) kept between two bars placed in the same
// row — pure visual breathing room, not a claim about the underlying dates.
export const MIN_ROW_GAP_YEARS = 5;

// A Period (a real duration — Person lifespans, Conflict ranges) always
// renders as a rounded-cap line; a PointInTime
// (ConflictEvents, Milestones) always renders as a dot. Both are drawn
// with SVG stroke, not fill, so `stroke-linecap: round` gives the
// pill-shaped caps.
export const PERIOD_LINE_HEIGHT = 6;
// Rough per-character estimate for the 11px label font — good enough to
// size row-stacking without a real DOM text-measurement pass.
export const AVG_CHAR_WIDTH_PX = 6;
// Row-stacking gap for pixel-space layouts — real screen pixels, not years,
// so much smaller than MIN_ROW_GAP_YEARS.
export const MIN_ROW_GAP_PX = 8;
// Approx rendered height of an 11px label.
const LABEL_TEXT_HEIGHT_PX = 13;

export function estimateLabelWidthPx(name: string): number {
  return name.length * AVG_CHAR_WIDTH_PX;
}

// Greedy word-wrap using the same rough per-character estimate as
// estimateLabelWidthPx — good enough to bound a label's rendered width
// without a real DOM text-measurement pass.
export function wrapLabelLines(name: string, maxWidthPx: number): string[] {
  const words = name.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine !== '' && estimateLabelWidthPx(candidate) > maxWidthPx) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  return lines;
}

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
export const MILESTONES_LABEL_MAX_WIDTH_PX = 72;

// Above-line label layout, used by People — the one lane whose Period bars
// don't all share a fixed marker y (they stack into vertical bands like a
// Gantt chart), so unlike the below-marker lane above, the label tier and
// the vertical band are the same "row" concept: a person's label sits just
// above their own lifespan line, both moving together per row.
const PERSON_LABEL_GAP = 2;
// Vertical budget per row: label height + gap + lifespan line + breathing
// room to the next row.
export const PERSON_ROW_PITCH = LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT + ROW_GAP;

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
  return personLabelYForRow(row, rowCount) + LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT / 2;
}

/** Total SVG height needed for the People lane with this many stacked rows. */
export function personLaneHeight(rowCount: number): number {
  if (rowCount === 0) return LANE_TOP_PADDING * 2;
  return LANE_TOP_PADDING + rowCount * PERSON_ROW_PITCH;
}

// Milestones' own palette. MilestoneCategory keeps its full 20-value
// taxonomy for filtering/labels (disjoint from Conflicts' ConflictCategory,
// which no longer drives a color — see CONFLICT_COLOR above), but color
// folds every category into 3 legible groups plus the flat Conflict red —
// 20 near-distinguishable hues at ~11° hue separation was below any
// CVD-safe spacing and more colors than a legend can hold anyway. Each
// group rhymes with (is a darker, richer step of) the People-domain hue its
// content actually echoes, so the color language is learned once: Knowledge
// & Culture deepens Humanities, Technology & Industry deepens Science &
// Technology, Society & Governance deepens Public Figure. See
// docs/design-tokens.md for the validation report and the full category ->
// group mapping. MILESTONE_CATEGORY_GROUP_COLORS itself lives in
// shared/config (imported above), not here, since the sidebar's Milestone
// Category Group filter pills need it too and features/ can't import from
// widgets/ under mini-FSD's layer rule — see that file's own comment.
//
// Derived from MILESTONE_CATEGORY_TO_GROUP (packages/shared-types) rather
// than listing per-category hexes directly, so the timeline's color and the
// sidebar's Milestone Category Group filter can never silently drift apart
// — public shape and values are unchanged (still one hex per
// MilestoneCategory, still exactly 3 distinct hexes).
export const MILESTONE_CATEGORY_COLORS: Record<MilestoneCategory, string> = Object.fromEntries(
  Object.entries(MILESTONE_CATEGORY_TO_GROUP).map(([category, group]) => [
    category,
    MILESTONE_CATEGORY_GROUP_COLORS[group],
  ]),
) as Record<MilestoneCategory, string>;

const MIN_YEAR = PAN_MIN_DATE.year;

// The Year Axis's CSS tick gradients (and the scroll container's full-height
// decade gridlines) tile starting at x=0, i.e. at MIN_YEAR. Round-historical
// BCE tick positions (format-year.ts's isRoundTickYear/roundTickYearsInRange
// — year ≡ 1 mod stepYears, e.g. -9/-19 for "10 BCE"/"20 BCE") sit on a
// different phase than CE ticks and the era-boundary tick at year 0
// (ordinary ≡ 0 mod stepYears, unchanged) — see
// docs/adr/0001-astronomical-year-numbering.md. A single repeating CSS
// background can only tile one phase, so YearAxis renders the ruler as two
// adjacent regions split at year 0, each using its own offset computed here.
function phaseOffsetYears(stepYears: number, anchorRemainder: number): number {
  const raw = (anchorRemainder - MIN_YEAR) % stepYears;
  return ((raw % stepYears) + stepYears) % stepYears;
}
export const DECADE_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(DECADE_STEP_YEARS, 0);
export const CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(CENTURY_STEP_YEARS, 0);
export const BCE_DECADE_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(DECADE_STEP_YEARS, 1);
export const BCE_CENTURY_TICK_PHASE_OFFSET_YEARS = phaseOffsetYears(CENTURY_STEP_YEARS, 1);

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
