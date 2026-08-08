import type {
  Category,
  Discovery,
  DiscoveryCategory,
  OccupationDomain,
  Period,
  Person,
  WarsAndConflictsEntry,
} from '../../shared/types';
import { today } from '../../shared/lib/dates';
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
    // Missing lifespan.end means still alive — draw through to today, not
    // a collapsed zero-width bar at their birth year.
    const personEndYear = person.lifespan.end?.year ?? today().year;

    return {
      id: person.id,
      name: person.name,
      startYear: person.lifespan.start.year,
      endYear: ensureMinimumRangeWidthYears(person.lifespan.start.year, personEndYear),
      occupationDomain: person.occupationDomain,
    };
  });
}

export interface WarItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  isPoint: boolean;
  category: Category;
}

// wars.json mixes War (a Period, `period` field) and WarEvent (a
// PointInTime, `at` field) — structurally disjoint, so this narrows with
// `"period" in entry` rather than a `kind` discriminant (see
// WarsAndConflictsEntry in shared-types). Every entry maps 1:1 into one
// unified WarItem shape either way; wars.json is already Wars &
// Conflicts-lane-only (data-pipeline's EVENT_TYPES filter), so no category
// filtering happens here.
export function mapWars(wars: WarsAndConflictsEntry[]): WarItem[] {
  return wars.map((entry) => {
    const isWar = 'period' in entry;
    const period: Period = isWar ? entry.period : { start: entry.at, end: undefined };
    const isPoint = !isWar;
    return {
      id: entry.id,
      name: entry.name,
      startYear: period.start.year,
      endYear: isPoint
        ? period.start.year
        : ensureMinimumRangeWidthYears(period.start.year, period.end?.year ?? period.start.year),
      isPoint,
      category: entry.category,
    };
  });
}

export interface DiscoveryItem {
  id: string;
  name: string;
  startYear: number;
  category: DiscoveryCategory;
}

// discoveries.json is always a PointInTime (data-pipeline's Discovery rows
// are always single-moment) — always a point, unlike wars.
export function mapDiscoveries(discoveries: Discovery[]): DiscoveryItem[] {
  return discoveries.map((discovery) => ({
    id: discovery.id,
    name: discovery.name,
    startYear: discovery.at.year,
    category: discovery.category,
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
// the People and Wars & Conflicts lanes with the default MIN_ROW_GAP_YEARS
// gap) but the algorithm is purely numeric — Events & Inventions reuses it
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
