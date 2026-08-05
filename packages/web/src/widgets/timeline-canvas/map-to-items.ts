import type { Category, Discovery, OccupationDomain, Person, War } from '../../shared/types';
import { today } from '../../shared/lib/dates';
import { MIN_ROW_GAP_YEARS } from './options';

// A zero- or negative-width range (e.g. a missing endYear) can't render as a
// visible bar — widen it to a minimum one-year span. Rendering-only: not a
// claim the underlying date data actually spans a year.
function ensureMinimumRangeWidthYears(startYear: number, endYear: number): number {
  return endYear <= startYear ? startYear + 1 : endYear;
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
      tooltip: `${person.name}: ${person.startYear}–${person.endYear ?? 'present'}`,
      reignPeriods: (person.reignPeriods ?? []).map((reignPeriod, index) => {
        const reignEnd = reignPeriod.endYear ?? personEnd;
        return {
          id: `${person.id}-reign-${index}`,
          startYear: reignPeriod.startYear,
          endYear: ensureMinimumRangeWidthYears(reignPeriod.startYear, reignEnd),
          tooltip: `${reignPeriod.title ?? 'Reign'}: ${reignPeriod.startYear}–${reignPeriod.endYear ?? '(end unknown)'}`,
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
// the first row whose last-placed end year clears it with MIN_ROW_GAP_YEARS
// to spare, else open a new row. Guarantees no two items in the same row
// ever overlap or crowd each other — shared by the People and Wars & Conflicts
// lanes (Events & Inventions is points-only and doesn't need it).
export function assignRows(items: RowInterval[]): Map<string, number> {
  const rowEndYears: number[] = [];
  const rowOfId = new Map<string, number>();

  const sorted = [...items].sort((a, b) => a.startYear - b.startYear);
  for (const item of sorted) {
    let row = rowEndYears.findIndex((lastEnd) => lastEnd + MIN_ROW_GAP_YEARS <= item.startYear);
    if (row === -1) {
      row = rowEndYears.length;
      rowEndYears.push(item.endYear);
    } else {
      rowEndYears[row] = item.endYear;
    }
    rowOfId.set(item.id, row);
  }

  return rowOfId;
}
