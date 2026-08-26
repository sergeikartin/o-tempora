import type * as d3 from 'd3';
import { CONFLICT_COLOR, DOMAIN_COLORS } from '../../shared/config';
import { today, yearMonthToFractionalYear } from '../../shared/lib/date';
import {
  estimateLabelWidthPx,
  LANE_TOP_PADDING,
  MILESTONE_CATEGORY_COLORS,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  MILESTONES_MARKER_LABEL_GAP,
  POINT_RADIUS,
  personLabelYForRow,
  personLineCenterYForRow,
  ROW_GAP,
  wrapLabelLines,
} from './options';

// The five filterBy*/filterConflictsByFilterValues functions moved to
// shared/lib/entity/ so features/search-timeline-entities (an FSD
// features/ module, which can't import from a widgets/ module) can reuse the
// exact same filtering pipeline as this widget — re-exported here so every
// existing import site (TimelineCanvas.tsx) keeps working unchanged.
export {
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
} from '../../shared/lib/entity';

import type {
  ConflictCategory,
  ConflictEntry,
  Milestone,
  MilestoneCategory,
  OccupationDomain,
  Period,
  Person,
} from '../../shared/types';

/** Pixel-space [start, end] interval a value maps to under a linear scale. */
export interface PixelInterval {
  start: number;
  end: number;
}

// A zero- or negative-width range (e.g. a missing end) can't render as a
// visible bar — widen it to a minimum one-year span. Rendering-only: not a
// claim the underlying date data actually spans a year.
function ensureMinimumRangeWidthYears(
  startYear: number,
  endYear: number,
): number {
  return endYear <= startYear ? startYear + 1 : endYear;
}

export interface PersonItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  occupationDomain: OccupationDomain;
  fameScore: number;
}

export function mapPeople(people: Person[]): PersonItem[] {
  const currentYear = today();
  return people.map((person) => {
    const personStartYear = yearMonthToFractionalYear(person.lifespan.start);
    // Missing lifespan.end means still alive — draw through to today, not
    // a collapsed zero-width bar at their birth year.
    const personEndYear = person.lifespan.end
      ? yearMonthToFractionalYear(person.lifespan.end)
      : currentYear;

    return {
      id: person.id,
      name: person.name,
      startYear: personStartYear,
      endYear: ensureMinimumRangeWidthYears(personStartYear, personEndYear),
      occupationDomain: person.occupationDomain,
      fameScore: person.fameScore,
    };
  });
}

// Row-stacking works in screen pixels, not years — a person's name label is
// left-aligned above the start of their lifespan line, so it can extend
// well past the line's own pixel span for a short-lived person with a long
// name, especially at low zoom. Shared by PeopleLane (its live viewport
// scale) and the Minimap minimap (a fixed Reference Scale, ADR
// 0004) so both pack rows with the same rule.
export function personPixelInterval(
  item: PersonItem,
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const labelWidth = estimateLabelWidthPx(item.name);
  return { start: x1, end: Math.max(x2, x1 + labelWidth) };
}

export interface PersonLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX2: number;
  labelY: number;
  lineY: number;
  fill: string;
}

/** Per-person screen-space layout for PeopleLane's D3 join — one row-stacked lifespan line + label per person. */
export function buildPersonLayout(
  people: Person[],
  xScale: d3.ScaleLinear<number, number>,
  personRowFor: (ids: string[]) => Map<string, number>,
): PersonLayout[] {
  const items = mapPeople(people);
  const rowOfPerson = personRowFor(items.map((item) => item.id));
  const rowCount =
    rowOfPerson.size > 0 ? Math.max(...rowOfPerson.values()) + 1 : 0;
  return items.map((item) => {
    const row = rowOfPerson.get(item.id) ?? 0;
    const x1 = xScale(item.startYear);
    const x2 = Math.max(xScale(item.endYear), x1 + 2);
    return {
      id: item.id,
      name: item.name,
      x1,
      x2,
      // Label is left-aligned at x1, so it never extends left of the
      // line — only right, past x2 for a short-lived person with a
      // long name.
      hitX2: Math.max(x2, x1 + estimateLabelWidthPx(item.name)),
      labelY: personLabelYForRow(row, rowCount),
      lineY: personLineCenterYForRow(row, rowCount),
      fill: DOMAIN_COLORS[item.occupationDomain],
    };
  });
}

export interface ConflictItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  isPoint: boolean;
  category: ConflictCategory;
  fameScore: number;
}

// conflicts.json mixes Conflict (a Period, `period` field) and
// ConflictEvent (a PointInTime, `at` field) — structurally disjoint, so
// this narrows with `"period" in entry` rather than a `kind` discriminant
// (see ConflictEntry in shared-types). Every entry maps 1:1 into one
// unified ConflictItem shape either way; conflicts.json is already
// Conflicts-lane-only (data-pipeline's EVENT_TYPES filter), so no category
// filtering happens here.
export function mapConflicts(conflicts: ConflictEntry[]): ConflictItem[] {
  return conflicts.map((entry) => {
    const isConflict = 'period' in entry;
    const period: Period = isConflict
      ? entry.period
      : { start: entry.at, end: undefined };
    const isPoint = !isConflict;
    const startYear = yearMonthToFractionalYear(period.start);
    return {
      id: entry.id,
      name: entry.name,
      startYear,
      endYear: isPoint
        ? startYear
        : ensureMinimumRangeWidthYears(
            startYear,
            period.end ? yearMonthToFractionalYear(period.end) : startYear,
          ),
      isPoint,
      category: entry.category,
      fameScore: entry.fameScore,
    };
  });
}

// Shared by conflictPixelInterval and milestonePixelInterval's own range
// branch below — a range's (Conflict's or a period-shaped Milestone's)
// pixel extent is the same single-line-label-centered calculation either
// way, per the "identical bar treatment" call (grill-with-docs session,
// 2026-08-12).
function rangePixelInterval(
  item: { name: string; startYear: number; endYear: number },
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const center = (x1 + x2) / 2;
  const labelHalf = estimateLabelWidthPx(item.name) / 2;
  return {
    start: Math.min(x1, center - labelHalf),
    end: Math.max(x2, center + labelHalf),
  };
}

// Shared by ConflictsMilestonesLane (its live viewport scale) and the
// Minimap minimap (a fixed Reference Scale, ADR 0004) so both pack
// rows with the same rule.
export function conflictPixelInterval(
  item: ConflictItem,
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  if (item.isPoint) {
    const x = xScale(item.startYear);
    const labelHalf = estimateLabelWidthPx(item.name) / 2;
    return {
      start: Math.min(x - POINT_RADIUS, x - labelHalf),
      end: Math.max(x + POINT_RADIUS, x + labelHalf),
    };
  }
  return rangePixelInterval(item, xScale);
}

export interface MilestoneItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  isPoint: boolean;
  category: MilestoneCategory;
  fameScore: number;
}

// milestones.json mixes point- and period-shaped Milestone rows — same
// "period" in entry narrowing mapConflicts uses (Milestone is now a
// Conflict/ConflictEvent-style union, see shared-types).
export function mapMilestones(milestones: Milestone[]): MilestoneItem[] {
  return milestones.map((milestone) => {
    const isPeriodShaped = 'period' in milestone;
    const period: Period = isPeriodShaped
      ? milestone.period
      : { start: milestone.at, end: undefined };
    const isPoint = !isPeriodShaped;
    const startYear = yearMonthToFractionalYear(period.start);
    return {
      id: milestone.id,
      name: milestone.name,
      startYear,
      endYear: isPoint
        ? startYear
        : ensureMinimumRangeWidthYears(
            startYear,
            period.end ? yearMonthToFractionalYear(period.end) : startYear,
          ),
      isPoint,
      category: milestone.category,
      fameScore: milestone.fameScore,
    };
  });
}

// Shared by ConflictsMilestonesLane (its live viewport scale) and the
// Minimap minimap (a fixed Reference Scale, ADR 0004) so both pack
// rows with the same rule. `lines` (the wrapped label) only matters for the
// point branch — a period-shaped Milestone renders as a range, sharing
// conflictPixelInterval's single-line-label range calculation via
// rangePixelInterval rather than the wrapped multi-line label points use.
export function milestonePixelInterval(
  item: MilestoneItem,
  lines: string[],
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  if (!item.isPoint) return rangePixelInterval(item, xScale);
  const x = xScale(item.startYear);
  const labelHalf =
    Math.max(...lines.map((line) => estimateLabelWidthPx(line))) / 2;
  return {
    start: Math.min(x - POINT_RADIUS, x - labelHalf),
    end: Math.max(x + POINT_RADIUS, x + labelHalf),
  };
}

export interface RangeLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX1: number;
  hitX2: number;
  row: number;
  markerY: number;
  labelY: number;
  fill: string;
  kind: 'conflict' | 'milestone';
}

export interface PointLayout {
  id: string;
  lines: string[];
  x: number;
  hitX1: number;
  hitX2: number;
  row: number;
  markerY: number;
  labelY: number;
  fill: string;
  kind: 'conflict' | 'milestone';
}

export interface RangeAndPointLayout {
  rangeLayout: RangeLayout[];
  pointLayout: PointLayout[];
  totalHeight: number;
}

/**
 * Combined screen-space layout for ConflictsMilestonesLane's two D3 joins —
 * ranges (Conflict periods + period-shaped Milestones) and points (Conflict
 * events + point-shaped Milestones) share one below-marker row-stacking pass
 * (see ConflictsMilestonesLane.tsx's own comment for why), so both come out
 * of a single function rather than two independently-packed ones.
 */
export function buildRangeAndPointLayout(
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  xScale: d3.ScaleLinear<number, number>,
  eventsRowFor: (ids: string[]) => Map<string, number>,
): RangeAndPointLayout {
  const conflictItems = mapConflicts(conflicts);
  const milestoneItems = mapMilestones(milestones);

  const milestoneLinesById = new Map<string, string[]>();
  for (const item of milestoneItems) {
    milestoneLinesById.set(
      item.id,
      wrapLabelLines(item.name, MILESTONES_LABEL_MAX_WIDTH_PX),
    );
  }

  const rowOfId = eventsRowFor([
    ...conflictItems.map((item) => item.id),
    ...milestoneItems.map((item) => item.id),
  ]);

  // Row height is dynamic — the tallest label actually assigned to a row
  // (a wrapped multi-line Milestone label, or a single-line Conflict label)
  // sets that row's pitch, so a multi-line label never bleeds into the row
  // below it.
  const maxLinesByRow: number[] = [];
  const noteRow = (row: number, lineCount: number) => {
    maxLinesByRow[row] = Math.max(maxLinesByRow[row] ?? 0, lineCount);
  };
  for (const item of conflictItems) noteRow(rowOfId.get(item.id) ?? 0, 1);
  for (const item of milestoneItems) {
    // Range-shaped Milestones render a single-line label like a Conflict
    // range does — only point-shaped Milestones wrap onto multiple lines.
    if (!item.isPoint) {
      noteRow(rowOfId.get(item.id) ?? 0, 1);
      continue;
    }
    const lines = milestoneLinesById.get(item.id) ?? [item.name];
    noteRow(rowOfId.get(item.id) ?? 0, lines.length);
  }
  const markerYs: number[] = [];
  const labelStarts: number[] = [];
  let y = LANE_TOP_PADDING + POINT_RADIUS; // marker center for row 0
  for (let row = 0; row < maxLinesByRow.length; row += 1) {
    markerYs[row] = y;
    const labelY = y + POINT_RADIUS + MILESTONES_MARKER_LABEL_GAP;
    labelStarts[row] = labelY;
    y =
      labelY +
      (maxLinesByRow[row] ?? 1) * MILESTONES_LABEL_LINE_HEIGHT_PX +
      ROW_GAP +
      POINT_RADIUS;
  }
  const totalHeight = y - POINT_RADIUS;

  const fallbackMarkerY = LANE_TOP_PADDING + POINT_RADIUS;
  const fallbackLabelY =
    fallbackMarkerY + POINT_RADIUS + MILESTONES_MARKER_LABEL_GAP;

  const conflictRanges: RangeLayout[] = conflictItems
    .filter((item) => !item.isPoint)
    .map((item) => {
      const row = rowOfId.get(item.id) ?? 0;
      const { start: hitX1, end: hitX2 } = conflictPixelInterval(item, xScale);
      return {
        id: item.id,
        name: item.name,
        x1: xScale(item.startYear),
        x2: xScale(item.endYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        labelY: labelStarts[row] ?? fallbackLabelY,
        fill: CONFLICT_COLOR,
        kind: 'conflict' as const,
      };
    });
  const milestoneRanges: RangeLayout[] = milestoneItems
    .filter((item) => !item.isPoint)
    .map((item) => {
      const row = rowOfId.get(item.id) ?? 0;
      // lines is only read on the point branch, which this (range) item
      // never takes — see milestonePixelInterval.
      const { start: hitX1, end: hitX2 } = milestonePixelInterval(
        item,
        [],
        xScale,
      );
      return {
        id: item.id,
        name: item.name,
        x1: xScale(item.startYear),
        x2: xScale(item.endYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        labelY: labelStarts[row] ?? fallbackLabelY,
        fill: MILESTONE_CATEGORY_COLORS[item.category],
        kind: 'milestone' as const,
      };
    });
  const rangeLayout = [...conflictRanges, ...milestoneRanges];

  const conflictPoints: PointLayout[] = conflictItems
    .filter((item) => item.isPoint)
    .map((item) => {
      const row = rowOfId.get(item.id) ?? 0;
      const { start: hitX1, end: hitX2 } = conflictPixelInterval(item, xScale);
      return {
        id: item.id,
        lines: [item.name],
        x: xScale(item.startYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        labelY: labelStarts[row] ?? fallbackLabelY,
        fill: CONFLICT_COLOR,
        kind: 'conflict' as const,
      };
    });
  const milestonePoints: PointLayout[] = milestoneItems
    .filter((item) => item.isPoint)
    .map((item) => {
      const row = rowOfId.get(item.id) ?? 0;
      const lines = milestoneLinesById.get(item.id) ?? [item.name];
      const { start: hitX1, end: hitX2 } = milestonePixelInterval(
        item,
        lines,
        xScale,
      );
      return {
        id: item.id,
        lines,
        x: xScale(item.startYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        labelY: labelStarts[row] ?? fallbackLabelY,
        fill: MILESTONE_CATEGORY_COLORS[item.category],
        kind: 'milestone' as const,
      };
    });
  const pointLayout = [...conflictPoints, ...milestonePoints];

  return { rangeLayout, pointLayout, totalHeight };
}

// Narrows a static row map (each entry's permanent TimelineEntry.row,
// precomputed once by data-pipeline at Output time — see
// docs/adr/0005-row-assignment-moves-to-the-pipeline.md) down to just the
// currently-visible `ids`, closing gaps left by whatever got filtered out.
// This re-indexes to consecutive integers starting at 0 in the *same
// relative order* as the static rows, so it never reorders two
// simultaneously-visible items relative to each other — it only ever shifts
// the whole set uniformly as gaps open/close.
export function compactRows(
  ids: string[],
  staticRowOf: Map<string, number>,
): Map<string, number> {
  const distinctStaticRows = [
    ...new Set(ids.map((id) => staticRowOf.get(id) ?? 0)),
  ].sort((a, b) => a - b);
  const compactedRowOfStaticRow = new Map(
    distinctStaticRows.map((staticRow, index) => [staticRow, index]),
  );
  return new Map(
    ids.map((id) => [
      id,
      compactedRowOfStaticRow.get(staticRowOf.get(id) ?? 0) ?? 0,
    ]),
  );
}

export interface RowAssignment {
  personRowFor: (ids: string[]) => Map<string, number>;
  eventsRowFor: (ids: string[]) => Map<string, number>;
}

// The one seam a consumer (a lane, the Minimap) needs for Row Depth: give it
// an id set it's currently rendering, get back the row each one occupies.
// Hides that this is actually two steps — each entry's static row, read
// straight off its pipeline-precomputed TimelineEntry.row (docs/adr/0005-
// row-assignment-moves-to-the-pipeline.md), then compacted down to the ids
// in play (compactRows, above) — so no caller can reintroduce the bug of
// narrowing a filtered set some other way (see ADR 0007's addendum). Safe to
// recompute on every render regardless of whether `people`/`conflicts`/
// `milestones` grow mid-session (Payload Tier's Tier 1 merge,
// docs/adr/0004-payload-tier-split-defers-low-fame-data.md) — it's a plain
// lookup, not a packing pass, so an already-visible entry's row can never
// shift underneath it.
export function computeRowAssignment(
  people: Person[],
  conflicts: ConflictEntry[],
  milestones: Milestone[],
): RowAssignment {
  const staticPersonRowOf = new Map(
    people.map((person) => [person.id, person.row ?? 0]),
  );
  const staticEventsRowOf = new Map<string, number>([
    ...conflicts.map((entry): [string, number] => [entry.id, entry.row ?? 0]),
    ...milestones.map((entry): [string, number] => [entry.id, entry.row ?? 0]),
  ]);
  return {
    personRowFor: (ids) => compactRows(ids, staticPersonRowOf),
    eventsRowFor: (ids) => compactRows(ids, staticEventsRowOf),
  };
}
