import type * as d3 from 'd3';
import { today, yearMonthToFractionalYear } from '../../shared/lib/date';
import { estimateLabelWidthPx, POINT_RADIUS } from './options';

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
