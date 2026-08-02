import type { DataItem } from 'vis-timeline/standalone';
import type { HistoricalEvent, Person } from '../../shared/types';
import { toLegacyDate, yearToPlainDate } from '../../shared/lib/dates';

export function mapPeopleToItems(people: Person[]): DataItem[] {
  return people.map((person) => ({
    id: person.id,
    content: person.name,
    group: 'people',
    type: 'range',
    className: `category-${person.category}`,
    start: toLegacyDate(yearToPlainDate(person.birthYear)),
    end: toLegacyDate(yearToPlainDate(person.deathYear ?? person.birthYear + 1)),
  }));
}

export function mapEventsToItems(events: HistoricalEvent[]): DataItem[] {
  return events.map((event) => ({
    id: event.id,
    content: event.name,
    group: 'events',
    type: 'point',
    className: `category-${event.category}`,
    start: toLegacyDate(yearToPlainDate(event.date)),
  }));
}
