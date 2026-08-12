import type * as d3 from 'd3';
import type {
  ConflictCategory,
  Milestone,
  MilestoneCategory,
  OccupationDomain,
  Period,
  Person,
  ConflictEntry,
  Region,
} from '../../shared/types';
import { today, yearMonthToFractionalYear } from '../../shared/lib/dates';
import { MIN_ROW_GAP_YEARS, POINT_RADIUS, estimateLabelWidthPx } from './options';

/** Pixel-space [start, end] interval a value maps to under a linear scale. */
export interface PixelInterval {
  start: number;
  end: number;
}

// A zero- or negative-width range (e.g. a missing end) can't render as a
// visible bar — widen it to a minimum one-year span. Rendering-only: not a
// claim the underlying date data actually spans a year.
function ensureMinimumRangeWidthYears(startYear: number, endYear: number): number {
  return endYear <= startYear ? startYear + 1 : endYear;
}

// Shared by all three lanes to gate entity density by the active Fame Tier
// (packages/web/docs/adr/0002-fame-tier-drives-zoom.md) — the data-pipeline
// already ships every entry down to the specialist floor, so this is the
// only filtering step; no re-ranking needed since each tier's threshold is
// just a `fameScore >=` cutoff on the same already-sorted-by-tier data.
export function filterByFameScore<T extends { fameScore: number }>(items: T[], minFameScore: number): T[] {
  return items.filter((item) => item.fameScore >= minFameScore);
}

// People-only Occupation Domain filter (sidebar Legend pills doubling as a
// filter, grill-with-docs session 2026-08-12). Multi-select OR: an item
// matches if its domain is any of the selected ones. An empty selection
// means unfiltered, not "match nothing" — mirrors filterByFameScore's floor
// of 0 always passing everything.
export function filterByOccupationDomain<T extends { occupationDomain: OccupationDomain }>(
  items: T[],
  selectedDomains: OccupationDomain[],
): T[] {
  if (selectedDomains.length === 0) return items;
  return items.filter((item) => selectedDomains.includes(item.occupationDomain));
}

// Shared Region filter, one control across all three lanes (grill-with-docs
// session 2026-08-12), applied to the raw per-lane datasets (Person/
// ConflictEntry/Milestone) alongside filterByFameScore/
// filterByOccupationDomain above — not the mapped *Item render shapes,
// which nothing downstream needs region tags on. Takes a `regionsOf`
// accessor rather than requiring `regionTags: Region[]` directly on T,
// since Conflicts/Milestones' native regionTags is already Region[] but
// People's is the finer UnRegion[] (see shared/config/region.ts's
// UN_REGION_TO_REGION) — callers resolve that difference, this stays
// region-shape-agnostic. Multi-select OR, empty selection means unfiltered.
// An item with no matching region tags at all never matches a non-empty
// selection, so it's excluded whenever any region filter is active — see
// CONTEXT.md's Region entry.
export function filterByRegion<T>(items: T[], selectedRegions: Region[], regionsOf: (item: T) => Region[]): T[] {
  if (selectedRegions.length === 0) return items;
  return items.filter((item) => regionsOf(item).some((region) => selectedRegions.includes(region)));
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
  return people.map((person) => {
    const personStartYear = yearMonthToFractionalYear(person.lifespan.start);
    // Missing lifespan.end means still alive — draw through to today, not
    // a collapsed zero-width bar at their birth year.
    const personEndYear = person.lifespan.end ? yearMonthToFractionalYear(person.lifespan.end) : today().year;

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
// scale) and the Mountain Profile minimap (a fixed Reference Scale, ADR
// 0004) so both pack rows with the same rule.
export function personPixelInterval(item: PersonItem, xScale: d3.ScaleLinear<number, number>): PixelInterval {
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
    const period: Period = isConflict ? entry.period : { start: entry.at, end: undefined };
    const isPoint = !isConflict;
    const startYear = yearMonthToFractionalYear(period.start);
    return {
      id: entry.id,
      name: entry.name,
      startYear,
      endYear: isPoint
        ? startYear
        : ensureMinimumRangeWidthYears(startYear, period.end ? yearMonthToFractionalYear(period.end) : startYear),
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
  return { start: Math.min(x1, center - labelHalf), end: Math.max(x2, center + labelHalf) };
}

// Shared by ConflictsMilestonesLane (its live viewport scale) and the
// Mountain Profile minimap (a fixed Reference Scale, ADR 0004) so both pack
// rows with the same rule.
export function conflictPixelInterval(item: ConflictItem, xScale: d3.ScaleLinear<number, number>): PixelInterval {
  if (item.isPoint) {
    const x = xScale(item.startYear);
    const labelHalf = estimateLabelWidthPx(item.name) / 2;
    return { start: Math.min(x - POINT_RADIUS, x - labelHalf), end: Math.max(x + POINT_RADIUS, x + labelHalf) };
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
    const period: Period = isPeriodShaped ? milestone.period : { start: milestone.at, end: undefined };
    const isPoint = !isPeriodShaped;
    const startYear = yearMonthToFractionalYear(period.start);
    return {
      id: milestone.id,
      name: milestone.name,
      startYear,
      endYear: isPoint
        ? startYear
        : ensureMinimumRangeWidthYears(startYear, period.end ? yearMonthToFractionalYear(period.end) : startYear),
      isPoint,
      category: milestone.category,
      fameScore: milestone.fameScore,
    };
  });
}

// Shared by ConflictsMilestonesLane (its live viewport scale) and the
// Mountain Profile minimap (a fixed Reference Scale, ADR 0004) so both pack
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
  const labelHalf = Math.max(...lines.map((line) => estimateLabelWidthPx(line))) / 2;
  return { start: Math.min(x - POINT_RADIUS, x - labelHalf), end: Math.max(x + POINT_RADIUS, x + labelHalf) };
}

interface RowInterval {
  id: string;
  startYear: number;
  endYear: number;
  fameScore: number;
}

// Fame-priority interval-graph row assignment: processes items by fame
// *tier* — fameScore rounded to the nearest integer, descending — rather
// than chronologically, greedily dropping each into the lowest-numbered row
// that's free of it (with `gap` breathing room) anywhere in its span — not
// just past the row's rightmost-so-far extent, since a lower-tier item
// processed later can need to slot in *before* an already-placed
// higher-tier item's start. The most famous tier claims row 0 first and
// keeps it as long as nothing later conflicts with it, so row 0 accumulates
// the highest-fame tier and each successive row skews progressively less
// famous — an approximate rank, not a guaranteed one, in exchange for never
// leaving a row empty just to preserve exact order. Each lane then decides
// which edge of its box row 0 sits against (see personLabelYForRow's
// row-count-based inversion vs. the below-marker lanes' row-0-at-top
// default) to land it next to the shared Year Axis.
//
// Rounding to an integer tier rather than sorting on the raw continuous
// score matters: items are processed chronologically *within* a tier
// (secondary sort key), which is the row-minimal order for greedy interval
// coloring — sorting by the raw score instead effectively randomizes
// processing order relative to time and fragments rows (a long-lived,
// slightly-more-famous person forces a new row for everyone whose span
// crosses theirs, even when a time-ordered pass would've interleaved them
// tightly). Real fameScore values cluster densely enough (People's default
// view spans just ~16 distinct integers) that this loses very little
// ranking precision for a real reduction in wasted rows.
//
// Field names read as years (its original use) but the algorithm is purely
// numeric — pixel-space callers pass x-pixel positions and a much smaller
// pixel gap instead.
export function assignRows(items: RowInterval[], gap: number = MIN_ROW_GAP_YEARS): Map<string, number> {
  const rowIntervals: RowInterval[][] = [];
  const rowOfId = new Map<string, number>();

  const sorted = [...items].sort(
    (a, b) => Math.round(b.fameScore) - Math.round(a.fameScore) || a.startYear - b.startYear || a.id.localeCompare(b.id),
  );
  for (const item of sorted) {
    const row = rowIntervals.findIndex((placed) =>
      placed.every((existing) => item.startYear >= existing.endYear + gap || item.endYear + gap <= existing.startYear),
    );
    if (row === -1) {
      rowOfId.set(item.id, rowIntervals.length);
      rowIntervals.push([item]);
    } else {
      rowOfId.set(item.id, row);
      rowIntervals[row]?.push(item);
    }
  }

  return rowOfId;
}
