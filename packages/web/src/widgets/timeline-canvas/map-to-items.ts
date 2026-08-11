import type {
  ConflictCategory,
  Milestone,
  MilestoneCategory,
  OccupationDomain,
  Period,
  Person,
  ConflictEntry,
} from '../../shared/types';
import { today, yearMonthToFractionalYear } from '../../shared/lib/dates';
import { MIN_ROW_GAP_YEARS } from './options';

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

export interface PersonItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  occupationDomain: OccupationDomain;
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
    };
  });
}

export interface MilestoneItem {
  id: string;
  name: string;
  startYear: number;
  category: MilestoneCategory;
}

// milestones.json is always a PointInTime (data-pipeline's Milestone rows
// are always single-moment) — always a point, unlike conflicts.
export function mapMilestones(milestones: Milestone[]): MilestoneItem[] {
  return milestones.map((milestone) => ({
    id: milestone.id,
    name: milestone.name,
    startYear: yearMonthToFractionalYear(milestone.at),
    category: milestone.category,
  }));
}

interface RowInterval {
  id: string;
  startYear: number;
  endYear: number;
}

// Greedy interval-graph row assignment: sort by start, drop each item into
// the first row whose last-placed end clears it with `gap` to spare, else
// open a new row. Guarantees no two items in the same row ever overlap or
// crowd each other. Field names read as years (its original use, shared by
// the People and Conflicts lanes with the default MIN_ROW_GAP_YEARS
// gap) but the algorithm is purely numeric — Milestones reuses it
// in pixel space (start/end as x-pixel positions spanning each point's
// estimated label width) to keep point labels from overlapping, passing its
// own much-smaller pixel gap.
export function assignRows(items: RowInterval[], gap: number = MIN_ROW_GAP_YEARS): Map<string, number> {
  const rowEnds: number[] = [];
  const rowOfId = new Map<string, number>();

  const sorted = [...items].sort((a, b) => a.startYear - b.startYear);
  for (const item of sorted) {
    let row = rowEnds.findIndex((lastEnd) => lastEnd + gap <= item.startYear);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(item.endYear);
    } else {
      rowEnds[row] = item.endYear;
    }
    rowOfId.set(item.id, row);
  }

  return rowOfId;
}
