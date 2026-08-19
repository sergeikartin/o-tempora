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
import { MILESTONE_CATEGORY_TO_GROUP } from '../../shared/types';
import { today, yearMonthToFractionalYear } from '../../shared/lib/dates';
import type { ConflictsMilestonesFilterValue } from '../../shared/config';
import {
  buildXScale,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  MIN_ROW_GAP_PX,
  MIN_ROW_GAP_YEARS,
  POINT_RADIUS,
  REFERENCE_PIXELS_PER_YEAR,
  estimateLabelWidthPx,
  wrapLabelLines,
} from './options';

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

// People-only Occupation Domain filter (sidebar's Occupation Domain pills
// doubling as a filter, grill-with-docs session 2026-08-12). Multi-select OR: an item
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
// accessor rather than requiring `regionTags: Region[]` directly on T so it
// stays shape-agnostic across the three lanes' entity types. Multi-select
// OR, empty selection means unfiltered. An item with no matching region
// tags at all never matches a non-empty selection, so it's excluded
// whenever any region filter is active — see CONTEXT.md's Region entry.
export function filterByRegion<T>(items: T[], selectedRegions: Region[], regionsOf: (item: T) => Region[]): T[] {
  if (selectedRegions.length === 0) return items;
  return items.filter((item) => regionsOf(item).some((region) => selectedRegions.includes(region)));
}

// The sidebar's "Conflicts & Milestones" section is one shared multi-select
// filter (revised 2026-08-12 to match Region/Occupation Domain's "one flat
// list, empty means unfiltered" convention — an earlier version split this
// into a separate Milestone Category Group filter and a differently-styled
// Conflicts toggle). `selectedValues` folds a UI-only 'conflicts' sentinel
// together with the 2 real MilestoneCategoryGroup values (see
// shared/config/conflicts-milestones-filter.ts) — these two functions each
// read the one shared array, keyed off whichever part of it applies to
// their own lane.

// Milestones-only: same 2-group level the Milestones lane's color already
// varies at (see MILESTONE_CATEGORY_TO_GROUP), not the 21-leaf-category
// level. A selected 'conflicts' sentinel is simply never equal to any
// MilestoneCategoryGroup, so it has no effect here.
export function filterByMilestoneCategoryGroup<T extends { category: MilestoneCategory }>(
  items: T[],
  selectedValues: ConflictsMilestonesFilterValue[],
): T[] {
  if (selectedValues.length === 0) return items;
  return items.filter((item) => selectedValues.includes(MILESTONE_CATEGORY_TO_GROUP[item.category]));
}

// Conflicts-only: Conflicts carry no color-driving grouping of their own
// (docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md), so
// this is an all-or-nothing gate keyed on whether the 'conflicts' sentinel
// is present in the shared selection, not a per-item predicate.
export function filterConflictsByFilterValues<T>(items: T[], selectedValues: ConflictsMilestonesFilterValue[]): T[] {
  if (selectedValues.length === 0) return items;
  return selectedValues.includes('conflicts') ? items : [];
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
// scale) and the Minimap minimap (a fixed Reference Scale, ADR
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
// Minimap minimap (a fixed Reference Scale, ADR 0004) so both pack
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

// Static per-item row identity: unlike a lane's own live per-render
// assignRows call (which packs whatever's currently filtered, at the
// live zoom), these run once against the *entire* dataset at a fixed
// REFERENCE_PIXELS_PER_YEAR — so a given person/conflict/milestone's row
// never changes because of a filter or a zoom level, only because the
// underlying dataset itself changed (a pipeline rebuild, not anything a
// user does in-session). Callers own memoizing this once per dataset
// (TimelineCanvas keys it off the full, unfiltered people/conflicts/
// milestones props, which are stable references for the whole session)
// and pass the result down to each lane, which then narrows it to
// whatever's currently visible via compactRows below.
function computeStaticPersonRows(people: Person[]): Map<string, number> {
  const { scale } = buildXScale(REFERENCE_PIXELS_PER_YEAR);
  const items = mapPeople(people).map((item) => {
    const { start, end } = personPixelInterval(item, scale);
    return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
  });
  return assignRows(items, MIN_ROW_GAP_PX);
}

// Conflicts and Milestones share one row-packing pass (see
// ConflictsMilestonesLane's own comment on why), so their static row
// identity has to be computed together too, from both full datasets at
// once.
function computeStaticConflictsMilestonesRows(conflicts: ConflictEntry[], milestones: Milestone[]): Map<string, number> {
  const { scale } = buildXScale(REFERENCE_PIXELS_PER_YEAR);
  const conflictItems = mapConflicts(conflicts).map((item) => {
    const { start, end } = conflictPixelInterval(item, scale);
    return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
  });
  const milestoneItems = mapMilestones(milestones).map((item) => {
    const lines = item.isPoint ? wrapLabelLines(item.name, MILESTONES_LABEL_MAX_WIDTH_PX) : [];
    const { start, end } = milestonePixelInterval(item, lines, scale);
    return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
  });
  return assignRows([...conflictItems, ...milestoneItems], MIN_ROW_GAP_PX);
}

// Narrows a static row map (computed once against the full dataset, see
// above) down to just the currently-visible `ids`, closing gaps left by
// whatever got filtered out. This re-indexes to consecutive integers
// starting at 0 in the *same relative order* as the static rows, so it
// never reorders two simultaneously-visible items relative to each other
// — it only ever shifts the whole set uniformly as gaps open/close. That's
// the key difference from re-running assignRows itself on a changed input
// set: assignRows' greedy first-fit choice is sensitive to exactly which
// items are present, so adding or removing one item can genuinely swap two
// unrelated items' relative row order — compactRows can't, by construction.
export function compactRows(ids: string[], staticRowOf: Map<string, number>): Map<string, number> {
  const distinctStaticRows = [...new Set(ids.map((id) => staticRowOf.get(id) ?? 0))].sort((a, b) => a - b);
  const compactedRowOfStaticRow = new Map(distinctStaticRows.map((staticRow, index) => [staticRow, index]));
  return new Map(ids.map((id) => [id, compactedRowOfStaticRow.get(staticRowOf.get(id) ?? 0) ?? 0]));
}

export interface RowAssignment {
  personRowFor: (ids: string[]) => Map<string, number>;
  eventsRowFor: (ids: string[]) => Map<string, number>;
}

// The one seam a consumer (a lane, the Minimap) needs for Row Depth: give it
// an id set it's currently rendering, get back the row each one occupies.
// Hides that this is actually two steps — a static per-item identity
// computed once against the full dataset, then compacted down to the ids in
// play (compactRows, above) — so no caller can reintroduce the bug of
// narrowing a filtered set some other way (see ADR 0007's addendum).
export function computeRowAssignment(people: Person[], conflicts: ConflictEntry[], milestones: Milestone[]): RowAssignment {
  const staticPersonRowOf = computeStaticPersonRows(people);
  const staticEventsRowOf = computeStaticConflictsMilestonesRows(conflicts, milestones);
  return {
    personRowFor: (ids) => compactRows(ids, staticPersonRowOf),
    eventsRowFor: (ids) => compactRows(ids, staticEventsRowOf),
  };
}
