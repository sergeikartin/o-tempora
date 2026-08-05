import type { DataItem } from 'vis-timeline/standalone';
import type { Discovery, Person, War } from '../../shared/types';
import { toLegacyDate, yearToPlainDate } from '../../shared/lib/dates';

// A zero- or negative-width range (e.g. a missing endYear) can't render as a
// visible bar — widen it to a minimum one-year span. Rendering-only: not a
// claim the underlying date data actually spans a year.
function ensureMinimumRangeWidthYears(startYear: number, endYear: number): number {
  return endYear <= startYear ? startYear + 1 : endYear;
}

export function mapPeopleToItems(people: Person[]): DataItem[] {
  return people.flatMap((person) => {
    const reignPeriods = person.reignPeriods ?? [];
    const subgroup = reignPeriods.length > 0 ? person.id : undefined;

    const personItem: DataItem = {
      id: person.id,
      content: person.name,
      group: 'people',
      subgroup,
      type: 'range',
      className: `category-${person.occupationDomain}`,
      start: toLegacyDate(yearToPlainDate(person.startYear)),
      end: toLegacyDate(
        yearToPlainDate(ensureMinimumRangeWidthYears(person.startYear, person.endYear ?? person.startYear)),
      ),
    };

    // Overlaid inside the person's own lifespan bar via a shared `subgroup`
    // (see options.ts's `stackSubgroups: false` on the People lane) — must
    // stay ordered directly after personItem so it paints on top, not
    // stacked into its own row.
    const reignItems: DataItem[] = reignPeriods.map((reignPeriod, index) => ({
      id: `${person.id}-reign-${index}`,
      content: '',
      group: 'people',
      subgroup: person.id,
      type: 'range',
      className: 'reign-period',
      title: `${reignPeriod.title ?? 'Reign'}: ${reignPeriod.startYear}–${reignPeriod.endYear ?? '(end unknown)'}`,
      start: toLegacyDate(yearToPlainDate(reignPeriod.startYear)),
      end: toLegacyDate(
        yearToPlainDate(
          ensureMinimumRangeWidthYears(
            reignPeriod.startYear,
            reignPeriod.endYear ?? person.endYear ?? reignPeriod.startYear,
          ),
        ),
      ),
    }));

    return [personItem, ...reignItems];
  });
}

// wars.json is already Wars & Conflicts-lane-only (data-pipeline's
// EVENT_TYPES filter), so every entry maps 1:1 — no category filtering here.
export function mapWarsAndConflictsToItems(wars: War[]): DataItem[] {
  return wars.map((war) => {
    const { endYear } = war;
    return {
      id: war.id,
      content: war.name,
      group: 'wars',
      type: endYear !== undefined ? 'range' : 'point',
      className: `category-${war.category}`,
      title: war.partOfWarName ? `${war.name} — part of ${war.partOfWarName}` : undefined,
      start: toLegacyDate(yearToPlainDate(war.startYear)),
      end:
        endYear !== undefined
          ? toLegacyDate(yearToPlainDate(ensureMinimumRangeWidthYears(war.startYear, endYear)))
          : undefined,
    };
  });
}

// discoveries.json never carries an endYear (data-pipeline's Discovery rows
// are always single-year) — always a point, unlike wars.
export function mapInventionsToItems(discoveries: Discovery[]): DataItem[] {
  return discoveries.map((discovery) => ({
    id: discovery.id,
    content: discovery.name,
    group: 'events',
    type: 'point',
    className: `category-${discovery.category}`,
    start: toLegacyDate(yearToPlainDate(discovery.startYear)),
  }));
}
