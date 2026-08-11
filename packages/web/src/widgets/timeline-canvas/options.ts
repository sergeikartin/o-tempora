import * as d3 from 'd3';
import { today } from '../../shared/lib/dates';
import {
  ZOOM_MIN_YEARS,
  ZOOM_MAX_YEARS,
  DEFAULT_VIEWPORT_START,
  DEFAULT_VIEWPORT_END,
  PAN_MIN_DATE,
} from '../../shared/config';
import type { ConflictCategory, MilestoneCategory } from '../../shared/types';

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

// Below-marker label layout, used by Conflicts (both its range lines
// and point dots) — a row's marker and label move down together, the label
// sitting just below its own marker, same as People's above-line treatment
// but flipped. An item that would otherwise collide with a neighbor doesn't
// move sideways; instead `assignRows` hands back a row (one MARKER_ROW_PITCH
// step down), pushing that item's marker+label pair as a unit. Milestones
// also sits below its marker but, since its labels now wrap
// across multiple lines, uses its own tighter gap and per-row-computed pitch
// instead of this fixed single-line one — see MILESTONES_MARKER_LABEL_GAP below
// and MilestonesLane.tsx's row-height computation.
// Small breathing room between a marker's bottom edge and its label.
const MARKER_LABEL_GAP = 8;
// Vertical budget per row: marker height + gap + one label's height + gap to
// the next row, so consecutive rows never collide.
export const MARKER_ROW_PITCH = POINT_RADIUS * 2 + MARKER_LABEL_GAP + LABEL_TEXT_HEIGHT_PX + ROW_GAP;

/** y (vertical center) of a row's marker (line or dot), using the dot's radius as the reference since it's the taller of the two marker shapes. */
export function markerCenterYForRow(row: number): number {
  return LANE_TOP_PADDING + POINT_RADIUS + row * MARKER_ROW_PITCH;
}

/** y of a row's label — sits just below that row's own marker. */
export function labelYForRow(row: number): number {
  return markerCenterYForRow(row) + POINT_RADIUS + MARKER_LABEL_GAP;
}

/** Total SVG height needed for a below-marker lane with this many stacked rows. */
export function markerLaneHeight(rowCount: number): number {
  if (rowCount === 0) return LANE_TOP_PADDING * 2;
  return labelYForRow(rowCount - 1) + LABEL_TEXT_HEIGHT_PX + ROW_GAP;
}

// Milestones' own below-marker layout: labels wrap across multiple
// lines (via wrapLabelLines above) rather than staying on one line, so a
// row's height varies with how many lines its tallest label needs —
// computed per-render in MilestonesLane.tsx, not as a fixed pitch like
// MARKER_ROW_PITCH above.
export const MILESTONES_MARKER_LABEL_GAP = 4;
export const MILESTONES_LABEL_LINE_HEIGHT_PX = LABEL_TEXT_HEIGHT_PX;
export const MILESTONES_LABEL_MAX_WIDTH_PX = 72;

// Above-line label layout, used by People — the one lane whose Period bars
// don't all share a fixed marker y (they stack into vertical bands like a
// Gantt chart), so unlike the below-marker lanes above, the label tier and
// the vertical band are the same "row" concept: a person's label sits just
// above their own lifespan line, both moving together per row.
const PERSON_LABEL_GAP = 2;
// Vertical budget per row: label height + gap + lifespan line + breathing
// room to the next row.
export const PERSON_ROW_PITCH = LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT + ROW_GAP;

/** y of a row's label — hangs just above that row's lifespan line. */
export function personLabelYForRow(row: number): number {
  return LANE_TOP_PADDING + row * PERSON_ROW_PITCH;
}

/** y (vertical center) of a row's lifespan line. */
export function personLineCenterYForRow(row: number): number {
  return personLabelYForRow(row) + LABEL_TEXT_HEIGHT_PX + PERSON_LABEL_GAP + PERIOD_LINE_HEIGHT / 2;
}

/** Total SVG height needed for the People lane with this many stacked rows. */
export function personLaneHeight(rowCount: number): number {
  if (rowCount === 0) return LANE_TOP_PADDING * 2;
  return LANE_TOP_PADDING + rowCount * PERSON_ROW_PITCH;
}

// Mirrors design-tokens.md's Conflict Category Palette — Conflicts
// keys its flat fill off `category`, unlike People's `occupationDomain`
// above. Same provisional-inlining reasoning.
//
// Hue-optimized against all 18 existing People/Domain + Milestone colors
// below (min ~8.5° hue separation from everything on screen, tighter than
// Milestone's ~11° precedent since there are 24 colors total sharing one
// hue circle — the two closest pairs, military-operation and
// war-of-independence, lean on S/L rather than hue alone for separation,
// same approach design-tokens.md's Domain palette already uses for
// public-figure/science-technology), matched to the same pastel S/L family.
// War-family categories (war/military-operation) grouped into warm
// red-orange-yellow hues; the rest (revolution through war-of-independence)
// into cooler green-blue-violet hues — see the taxonomy rename/expand
// ticket's Answer for the generation method. battle/siege/peace-treaty
// dropped from ConflictCategory (see shared-types) — their hex values
// aren't reused here to avoid implying a relationship to the categories
// that replaced their slot in the hue circle.
export const CONFLICT_CATEGORY_COLORS: Record<ConflictCategory, string> = {
  war: '#BF696B',
  'military-operation': '#BDC251',
  revolution: '#7DBE74',
  rebellion: '#6BBDB3',
  'coup-d-etat': '#7BA8C1',
  'war-of-independence': '#8E8DC4',
};

// Milestones' own palette, keyed on MilestoneCategory (disjoint
// from Conflicts' ConflictCategory above). Locked with the user via
// .scratch/events-inventions-curated-source/issues/01-discovery-category-color-palette.md:
// hue-optimized against all 15 existing People/Domain + Conflicts/ConflictCategory
// colors (min ~11° hue separation from everything on screen) as they stood
// at the time — matched to the same pastel S/L family as the rest of the
// app.
export const MILESTONE_CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  'energy-industry': '#C9BF5E',
  'food-agriculture': '#B1C987',
  infrastructure: '#83B95B',
  'medicine-health': '#72B67E',
  'science-theory': '#70BCC2',
  communication: '#8099C6',
  transportation: '#8D82C4',
  'society-administration': '#9D6DB0',
  'everyday-technology': '#C893C8',
  exploration: '#C072AB',
};

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
