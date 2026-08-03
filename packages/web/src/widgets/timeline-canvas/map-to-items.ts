import type { DataItem } from 'vis-timeline/standalone';
import type { HistoricalEvent, Person } from '../../shared/types';
import { toLegacyDate, yearToPlainDate } from '../../shared/lib/dates';

// A zero- or negative-width range (e.g. a missing deathYear, or a war whose
// Wikidata start/end year are identical) can't render as a visible bar —
// widen it to a minimum one-year span. Rendering-only: not a claim the
// underlying date data actually spans a year.
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
      className: `category-${person.category}`,
      start: toLegacyDate(yearToPlainDate(person.birthYear)),
      end: toLegacyDate(
        yearToPlainDate(ensureMinimumRangeWidthYears(person.birthYear, person.deathYear ?? person.birthYear)),
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
      title: `Reign: ${reignPeriod.startYear}–${reignPeriod.endYear ?? '(end unknown)'}`,
      start: toLegacyDate(yearToPlainDate(reignPeriod.startYear)),
      end: toLegacyDate(
        yearToPlainDate(
          ensureMinimumRangeWidthYears(
            reignPeriod.startYear,
            reignPeriod.endYear ?? person.deathYear ?? reignPeriod.startYear,
          ),
        ),
      ),
    }));

    return [personItem, ...reignItems];
  });
}

export function mapWarsAndConflictsToItems(events: HistoricalEvent[]): DataItem[] {
  return events
    .filter((event) => event.category !== 'invention')
    .map((event) => {
      const { endDate } = event;
      return {
        id: event.id,
        content: event.name,
        group: 'wars',
        type: endDate !== undefined ? 'range' : 'point',
        className: `category-${event.category}`,
        title: event.partOfWarName ? `${event.name} — part of ${event.partOfWarName}` : undefined,
        start: toLegacyDate(yearToPlainDate(event.date)),
        end:
          endDate !== undefined
            ? toLegacyDate(yearToPlainDate(ensureMinimumRangeWidthYears(event.date, endDate)))
            : undefined,
      };
    });
}

export function mapInventionsToItems(events: HistoricalEvent[]): DataItem[] {
  return events
    .filter((event) => event.category === 'invention')
    .map((event) => ({
      id: event.id,
      content: event.name,
      group: 'events',
      type: 'point',
      className: `category-${event.category}`,
      start: toLegacyDate(yearToPlainDate(event.date)),
    }));
}
