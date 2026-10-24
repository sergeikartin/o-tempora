import type { ConflictEntry, Milestone, Person, YearMonth } from '../../types';
import { today, yearMonthToFractionalYear } from '../date';

// What one Selection member occupies on the time axis, to the precision the
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
  startYear: number;
  endYear: number;
}

export function spanYears(span: Pick<EntitySpan, 'start' | 'end'>): YearSpan {
  return {
    startYear: yearMonthToFractionalYear(span.start),
    endYear: yearMonthToFractionalYear(span.end),
  };
}

export interface Overlap {
  start: YearMonth;
  end: YearMonth;
}

// The span every member shares: the latest start to the earliest end, with a
// PointInTime as a zero-length span, so it counts only when it falls inside
// every Period. Null for fewer than two members and when no common span exists.
// Shared by the Overlap Band and the detail panel's overlap line so the two
// can't disagree.
export function computeOverlap(spans: readonly EntitySpan[]): Overlap | null {
  const [first, ...rest] = spans;
  if (!first || rest.length === 0) return null;
  let start = first.start;
  let end = first.end;
  for (const span of rest) {
    if (
      yearMonthToFractionalYear(span.start) > yearMonthToFractionalYear(start)
    ) {
      start = span.start;
    }
    if (yearMonthToFractionalYear(span.end) < yearMonthToFractionalYear(end)) {
      end = span.end;
    }
  }
  return yearMonthToFractionalYear(start) <= yearMonthToFractionalYear(end)
    ? { start, end }
    : null;
}

// The smallest year range holding every span, for fitting the viewport.
export function unionYears(spans: readonly EntitySpan[]): YearSpan | null {
  if (spans.length === 0) return null;
  const years = spans.map(spanYears);
  return {
    startYear: Math.min(...years.map((span) => span.startYear)),
    endYear: Math.max(...years.map((span) => span.endYear)),
  };
}
