import type { Category, Discovery, OccupationDomain, Person, War } from '../../shared/types';
import { today } from '../../shared/lib/dates';
import { formatYear } from '../../shared/lib/format-year';
import { MIN_ROW_GAP_YEARS } from './options';

// A zero- or negative-width range (e.g. a missing endYear) can't render as a
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

export interface ReignPeriodItem {
  id: string;
  startYear: number;
  endYear: number;
  tooltip: string;
}

export interface PersonItem {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  occupationDomain: OccupationDomain;
  tooltip: string;
  reignPeriods: ReignPeriodItem[];
}

export function mapPeople(people: Person[]): PersonItem[] {
  return people.map((person) => {
    // Missing endYear means still alive — draw through to today, not a
    // collapsed zero-width bar at their birth year.
    const personEnd = person.endYear ?? today().year;

    return {
      id: person.id,
      name: person.name,
      startYear: person.startYear,
      endYear: ensureMinimumRangeWidthYears(person.startYear, personEnd),
      occupationDomain: person.occupationDomain,
      tooltip: `${person.name}: ${formatYear(person.startYear)}–${person.endYear !== undefined ? formatYear(person.endYear) : 'present'}`,
      reignPeriods: (person.reignPeriods ?? []).map((reignPeriod, index) => {
        const reignEnd = reignPeriod.endYear ?? personEnd;
        return {
          id: `${person.id}-reign-${index}`,
          startYear: reignPeriod.startYear,
          endYear: ensureMinimumRangeWidthYears(reignPeriod.startYear, reignEnd),
          tooltip: `${reignPeriod.title ?? 'Reign'}: ${formatYear(reignPeriod.startYear)}–${reignPeriod.endYear !== undefined ? formatYear(reignPeriod.endYear) : '(end unknown)'}`,
        };
      }),
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
  tooltip: string;
}

// wars.json is already Wars & Conflicts-lane-only (data-pipeline's
// EVENT_TYPES filter), so every entry maps 1:1 — no category filtering here.
export function mapWars(wars: War[]): WarItem[] {
  return wars.map((war) => {
    const isPoint = war.endYear === undefined;
    return {
      id: war.id,
      name: war.name,
      startYear: war.startYear,
      endYear: isPoint ? war.startYear : ensureMinimumRangeWidthYears(war.startYear, war.endYear as number),
      isPoint,
      category: war.category,
      tooltip: war.partOfWarName ? `${war.name} — part of ${war.partOfWarName}` : war.name,
    };
  });
}

export interface DiscoveryItem {
  id: string;
  name: string;
  startYear: number;
  category: Category;
  tooltip: string;
}

// discoveries.json never carries an endYear (data-pipeline's Discovery rows
// are always single-year) — always a point, unlike wars.
export function mapDiscoveries(discoveries: Discovery[]): DiscoveryItem[] {
  return discoveries.map((discovery) => ({
    id: discovery.id,
    name: discovery.name,
    startYear: discovery.startYear,
    category: discovery.category,
    tooltip: discovery.name,
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
