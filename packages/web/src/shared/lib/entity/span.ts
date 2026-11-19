import type { ConflictEntry, Milestone, Person, YearMonth } from '../../types';
import { today, yearMonthToFractionalYear } from '../date';

// What the selected entity occupies on the time axis, to the precision the
// data has. A PointInTime has equal ends.
export interface EntitySpan {
  start: YearMonth;
  end: YearMonth;
  isPoint: boolean;
  // A Period with no end that runs through to the present (a living person).
  isOngoing: boolean;
}

export type SpannedEntity = Person | ConflictEntry | Milestone;

// Mirrors how the lanes place each shape (map-to-items.ts): a lifespan with no
// end runs to the current year; any other Period without an end is as long as
// its start.
export function entitySpan(
  entity: SpannedEntity,
  currentYear = today(),
): EntitySpan {
  if ('lifespan' in entity) {
    const { start, end } = entity.lifespan;
    return {
      start,
      end: end ?? { year: currentYear },
      isPoint: false,
      isOngoing: end === undefined,
    };
  }
  if ('period' in entity) {
    const { start, end } = entity.period;
    return { start, end: end ?? start, isPoint: false, isOngoing: false };
  }
  return { start: entity.at, end: entity.at, isPoint: true, isOngoing: false };
}

export interface YearSpan {
  startApproximate?: true;
  endApproximate?: true;
  startYear: number;
  endYear: number;
}

export function spanYears(span: Pick<EntitySpan, 'start' | 'end'>): YearSpan {
  return {
    ...(span.start.approximate && { startApproximate: true as const }),
    ...(span.end.approximate && { endApproximate: true as const }),
    startYear: yearMonthToFractionalYear(span.start),
    endYear: yearMonthToFractionalYear(span.end),
  };
}
