import type * as d3 from 'd3';
import { CONFLICT_COLOR, DOMAIN_COLORS } from '../../shared/config';
import { today, yearMonthToFractionalYear } from '../../shared/lib/date';
import {
  estimateLabelWidthPx,
  LANE_CAPTION_GUTTER_PX,
  LANE_TOP_PADDING,
  MILESTONE_CATEGORY_COLORS,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  MILESTONES_MARKER_LABEL_GAP,
  POINT_LABEL_OFFSET_PX,
  POINT_RADIUS,
  personLabelYForRow,
  personLineCenterYForRow,
  ROW_GAP,
  wrapMarkLabelLines,
} from './options';

// The filterBy*/filterConflictsByFilterValues functions live in
// shared/lib/entity/ so features/search-timeline-entities (which can't import
// from widgets/) uses the same filtering pipeline; re-exported here.
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

// A zero- or negative-width range (e.g. a missing end) can't render as a bar,
// so it is widened to a minimum one-year span. Rendering only; not a claim the
// data spans a year.
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

// Row-stacking works in screen pixels, not years: a person's label is
// left-aligned above their line start, so for a short-lived person with a long
// name it can extend well past the line, especially at low zoom. Shared by
// PeopleLane (live scale) and the Minimap (Reference Scale, web/docs/adr/0004)
// so both pack rows the same way.
export function personPixelInterval(
  item: PersonItem,
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const labelWidth = estimateLabelWidthPx(item.name);
  return { start: x1, end: Math.max(x2, x1 + labelWidth) };
}

// Gap kept between the lane caption's margin strip and a pinned label.
export const PINNED_LABEL_INSET_PX = LANE_CAPTION_GUTTER_PX + 8;

export interface PersonLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX2: number;
  // Where the next bar in this row starts (Infinity for the last): the room a
  // pinned label may extend into once its own bar has ended.
  labelRoomX2: number;
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
  const layout = items.map((item) => {
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
      labelRoomX2: Number.POSITIVE_INFINITY,
      labelY: personLabelYForRow(row, rowCount),
      lineY: personLineCenterYForRow(row, rowCount),
      fill: DOMAIN_COLORS[item.occupationDomain],
    };
  });
  const rowMembers = new Map<number, PersonLayout[]>();
  for (const entry of layout) {
    const members = rowMembers.get(entry.labelY) ?? [];
    members.push(entry);
    rowMembers.set(entry.labelY, members);
  }
  for (const members of rowMembers.values()) {
    members.sort((a, b) => a.x1 - b.x1);
    members.forEach((entry, i) => {
      const next = members[i + 1];
      if (next) entry.labelRoomX2 = next.x1;
    });
  }
  return layout;
}

/**
 * Where a person's label sits at `scrollLeft`. A label whose bar began left of
 * the viewport slides right to stay readable. It leaves with the bar's end
 * (`x2`) and stops short of the next bar in its row (`labelRoomX2`), so it can
 * never float free of its bar or run into the next label.
 */
export function pinnedLabelX(
  item: Pick<PersonLayout, 'name' | 'x1' | 'x2' | 'labelRoomX2'>,
  scrollLeft: number,
): number {
  const lastX = Math.min(
    item.x2,
    item.labelRoomX2 - estimateLabelWidthPx(item.name),
  );
  return Math.max(item.x1, Math.min(scrollLeft + PINNED_LABEL_INSET_PX, lastX));
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

// conflicts.json mixes Conflict (a Period, `period` field) and ConflictEvent
// (a PointInTime, `at` field), structurally disjoint, so this narrows with
// `"period" in entry` instead of a `kind` discriminant (see ConflictEntry in
// shared-types). Every entry maps 1:1 to one ConflictItem shape; the data is
// already Conflicts-only, so no category filtering happens here.
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

// Shared by conflictPixelInterval and milestonePixelInterval's range branch:
// a Conflict's or period-shaped Milestone's pixel extent is the same
// left-aligned single-line-label calculation.
function rangePixelInterval(
  item: { name: string; startYear: number; endYear: number },
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const labelWidth = Math.max(
    ...wrapMarkLabelLines(item.name).map(estimateLabelWidthPx),
  );
  return { start: x1, end: Math.max(x2, x1 + labelWidth) };
}

// A point's label sits to the right of its dot, on the same line.
function pointPixelInterval(name: string, x: number): PixelInterval {
  const labelWidth = Math.max(
    ...wrapMarkLabelLines(name).map(estimateLabelWidthPx),
  );
  return {
    start: x - POINT_RADIUS,
    end: x + POINT_LABEL_OFFSET_PX + labelWidth,
  };
}

// Shared by ConflictsMilestonesLane (live scale) and the Minimap (Reference
// Scale, web/docs/adr/0004) so both pack rows the same way.
export function conflictPixelInterval(
  item: ConflictItem,
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  if (item.isPoint) {
    return pointPixelInterval(item.name, xScale(item.startYear));
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

// milestones.json mixes point- and period-shaped Milestones, narrowed with
// `"period" in entry` like mapConflicts.
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

// Shared by ConflictsMilestonesLane (live scale) and the Minimap (Reference
// Scale, web/docs/adr/0004) so both pack rows the same way.
export function milestonePixelInterval(
  item: MilestoneItem,
  xScale: d3.ScaleLinear<number, number>,
): PixelInterval {
  if (!item.isPoint) return rangePixelInterval(item, xScale);
  return pointPixelInterval(item.name, xScale(item.startYear));
}

export interface RangeLayout {
  id: string;
  name: string;
  lines: string[];
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
  fill: string;
  kind: 'conflict' | 'milestone';
}

export interface RangeAndPointLayout {
  rangeLayout: RangeLayout[];
  pointLayout: PointLayout[];
  totalHeight: number;
}

/**
 * Combined screen-space layout for ConflictsMilestonesLane's two D3 joins:
 * ranges (Conflict periods + period-shaped Milestones) and points (Conflict
 * events + point-shaped Milestones) share one row-stacking pass (see
 * ConflictsMilestonesLane.tsx), so one function produces both.
 */
export function buildRangeAndPointLayout(
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  xScale: d3.ScaleLinear<number, number>,
  eventsRowFor: (ids: string[]) => Map<string, number>,
): RangeAndPointLayout {
  const conflictItems = mapConflicts(conflicts);
  const milestoneItems = mapMilestones(milestones);

  const rowOfId = eventsRowFor([
    ...conflictItems.map((item) => item.id),
    ...milestoneItems.map((item) => item.id),
  ]);

  // Row height is dynamic: the tallest label in a row (a period's label wraps to
  // up to two lines; point labels sit beside their dot) sets its pitch, so a
  // two-line label never bleeds into the next row.
  const maxLinesByRow: number[] = [];
  for (const item of [...conflictItems, ...milestoneItems]) {
    const row = rowOfId.get(item.id) ?? 0;
    const lineCount = item.isPoint ? 1 : wrapMarkLabelLines(item.name).length;
    maxLinesByRow[row] = Math.max(maxLinesByRow[row] ?? 0, lineCount);
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
        lines: wrapMarkLabelLines(item.name),
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
      const { start: hitX1, end: hitX2 } = milestonePixelInterval(item, xScale);
      return {
        id: item.id,
        name: item.name,
        lines: wrapMarkLabelLines(item.name),
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
        lines: wrapMarkLabelLines(item.name),
        x: xScale(item.startYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        fill: CONFLICT_COLOR,
        kind: 'conflict' as const,
      };
    });
  const milestonePoints: PointLayout[] = milestoneItems
    .filter((item) => item.isPoint)
    .map((item) => {
      const row = rowOfId.get(item.id) ?? 0;
      const { start: hitX1, end: hitX2 } = milestonePixelInterval(item, xScale);
      return {
        id: item.id,
        lines: wrapMarkLabelLines(item.name),
        x: xScale(item.startYear),
        hitX1,
        hitX2,
        row,
        markerY: markerYs[row] ?? fallbackMarkerY,
        fill: MILESTONE_CATEGORY_COLORS[item.category],
        kind: 'milestone' as const,
      };
    });
  const pointLayout = [...conflictPoints, ...milestonePoints];

  return { rangeLayout, pointLayout, totalHeight };
}

// Narrows a static row map (each entry's permanent TimelineEntry.row, computed
// by the pipeline, docs/adr/0005-row-assignment-moves-to-the-pipeline.md) to
// the visible `ids`, closing gaps. Rows are re-indexed from 0 in the same
// relative order, so two visible items never swap; the set only shifts
// uniformly as gaps open and close.
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

// The one seam a lane or the Minimap needs for Row Depth: give it the ids
// being rendered, get each one's row. It hides the two steps (read each
// entry's pipeline-computed TimelineEntry.row, then compactRows) so no caller
// can narrow a filtered set another way (docs/adr/0005's addendum). A plain
// lookup, not a packing pass, so it is safe to recompute every render, even as
// the datasets grow when deeper Detail Levels load: an already-visible entry's
// row can't shift.
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
