import type { YearMonth } from '../types';

export function today(): Temporal.PlainDate {
  return Temporal.Now.plainDateISO();
}

// Projects a YearMonth onto a single continuous number so it can be used as
// a position on the timeline's year-keyed x-scale — plain `year` when month
// is unknown (same as month 1, i.e. no offset), else `year` plus the
// fraction of the year elapsed by the start of that month.
export function yearMonthToFractionalYear(yearMonth: YearMonth): number {
  if (yearMonth.month === undefined) return yearMonth.year;
  return yearMonth.year + (yearMonth.month - 1) / 12;
}
