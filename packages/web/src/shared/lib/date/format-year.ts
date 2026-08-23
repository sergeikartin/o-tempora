import type { YearMonth } from '../../types';

// Every year in the rendering path is a plain signed integer using
// astronomical numbering (year 0 is 1 BCE, year 1 is 1 CE — the same
// convention Temporal.PlainDate's ISO calendar uses natively; see
// packages/shared-types's TimelineEntry comment). This is the one place
// that turns that internal representation into the "N BCE" / plain "N"
// strings users actually see, so BCE-ness and the off-by-one BCE-year
// conversion aren't reimplemented at each call site (YearAxis's ticks and
// century header, map-to-items.ts's tooltips).

/** True when a plain end-to-end year (ISO/astronomical numbering) falls BCE. */
export function isBceYear(year: number): boolean {
  return year <= 0;
}

/** Signed plain year -> "N BCE" for BCE years, plain "N" for CE years. */
export function formatYear(year: number): string {
  return isBceYear(year) ? `${1 - year} BCE` : `${year}`;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// month absent means the source data is only certain to the year (see
// shared-types's YearMonth) — falls back to formatYear alone rather than
// guessing a month. Hardcoded month names rather than a date-object
// formatter: the source of truth is already a plain 1-12 integer, not a
// date value needing calendar-aware construction just to name a month.
export function formatYearMonth(yearMonth: YearMonth): string {
  if (yearMonth.month === undefined) return formatYear(yearMonth.year);
  return `${MONTH_NAMES[yearMonth.month - 1]} ${formatYear(yearMonth.year)}`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export interface CenturyBoundary {
  /** Earliest plain year (inclusive) belonging to this century bucket. */
  startYear: number;
  /** Latest plain year (inclusive) belonging to this century bucket. */
  endYear: number;
  /** e.g. "1800s" (CE) or "3rd century BCE". */
  label: string;
}

// CE centuries bucket as "N00s" (1800-1899 -> "1800s"), matching common
// usage; years 1-99 CE have no such decade-style name (there's no "0s"),
// so they fall back to ordinal form for consistency with the BCE side.
// BCE centuries are always 100 years wide and ordinal-numbered outward from
// year 1 BCE (astronomical year 0) — 1st century BCE is years 1-100 BCE.
export function centuryBoundaryForYear(year: number): CenturyBoundary {
  if (year >= 100) {
    const startYear = Math.floor(year / 100) * 100;
    return { startYear, endYear: startYear + 99, label: `${startYear}s` };
  }
  if (year >= 1) {
    return { startYear: 1, endYear: 99, label: '1st century CE' };
  }
  const bceYear = 1 - year;
  const centuryNumber = Math.ceil(bceYear / 100);
  return {
    startYear: 1 - centuryNumber * 100,
    endYear: -100 * (centuryNumber - 1),
    label: `${ordinal(centuryNumber)} century BCE`,
  };
}

/** Every century boundary overlapping [startYear, endYear], ascending, no gaps. */
export function centuryBoundariesInRange(
  startYear: number,
  endYear: number,
): CenturyBoundary[] {
  const boundaries: CenturyBoundary[] = [];
  let cursor = startYear;
  while (cursor <= endYear) {
    const boundary = centuryBoundaryForYear(cursor);
    boundaries.push(boundary);
    cursor = boundary.endYear + 1;
  }
  return boundaries;
}

// A tick grid built from round *astronomical* numbers (..., -200, -100, 0,
// 100, ...) mislabels every BCE tick by one year once formatYear converts it
// (year -100 reads "101 BCE", not "100 BCE") — astronomical numbering has a
// year 0 that true historical BCE/CE counting doesn't. The common historical-
// timeline fix isn't to relabel every BCE tick — it's to keep every *other*
// tick on its normal round-number spacing and absorb the missing year 0 into
// a single dedicated tick right at the era boundary, year 0 itself ("1 BCE"),
// which makes exactly the one BCE segment touching it (e.g. "10 BCE" to
// "1 BCE") one tick narrower than every other segment.

/** True when `year` sits on a round `stepYears` tick in historical (no-year-0) terms. */
export function isRoundTickYear(year: number, stepYears: number): boolean {
  if (year === 0) return true; // "1 BCE" — the era-boundary tick, always shown
  return year > 0 ? year % stepYears === 0 : (1 - year) % stepYears === 0;
}

/** Every round `stepYears` tick year in [startYear, endYear], ascending. */
export function roundTickYearsInRange(
  startYear: number,
  endYear: number,
  stepYears: number,
): number[] {
  const years: number[] = [];
  if (startYear <= 0 && endYear >= 0) years.push(0);
  if (startYear < 0) {
    const maxSteps = Math.ceil((1 - startYear) / stepYears);
    for (let k = 1; k <= maxSteps; k++) {
      const year = 1 - k * stepYears;
      if (year >= startYear && year <= endYear) years.push(year);
    }
  }
  if (endYear > 0) {
    const firstCeYear = Math.max(
      stepYears,
      Math.ceil(Math.max(startYear, 1) / stepYears) * stepYears,
    );
    for (let year = firstCeYear; year <= endYear; year += stepYears)
      years.push(year);
  }
  return years.sort((a, b) => a - b);
}
