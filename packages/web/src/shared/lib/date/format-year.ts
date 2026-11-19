import { m } from '../../paraglide/messages.js';
import { getLocale } from '../../paraglide/runtime.js';
import type { YearMonth } from '../../types';

// Convert astronomical years for display here so every caller handles year 0 as 1 BCE.

export function isBceYear(year: number): boolean {
  return year <= 0;
}

export function formatYear(year: number): string {
  return isBceYear(year) ? m.yearBce({ year: 1 - year }) : `${year}`;
}

// When both ends are BCE the era suffix is stated once, on the later end
// ("300 – 200 BCE"), so a range stays short enough to set at display size.
export function formatYearRange(startYear: number, endYear: number): string {
  if (isBceYear(startYear) && isBceYear(endYear)) {
    return `${1 - startYear} – ${formatYear(endYear)}`;
  }
  return `${formatYear(startYear)} – ${formatYear(endYear)}`;
}

// Month names come from Intl in the active locale, so the Russian UI never
// shows English months. The source is a plain 1-12 integer, not a date value,
// so the formatter is fed a fixed UTC date in that month.
function monthName(month: number, width: 'long' | 'short'): string {
  return new Intl.DateTimeFormat(getLocale(), {
    month: width,
    timeZone: 'UTC',
  }).format(Date.UTC(2000, month - 1, 1));
}

// An absent month means the source is only certain to the year (see
// shared-types's YearMonth), so this falls back to formatYear alone rather
// than guessing.
export function formatYearMonth(yearMonth: YearMonth): string {
  if (yearMonth.month === undefined) return formatYear(yearMonth.year);
  return `${monthName(yearMonth.month, 'long')} ${formatYear(yearMonth.year)}`;
}

export function formatYearMonthShort(yearMonth: YearMonth): string {
  if (yearMonth.month === undefined) return formatYear(yearMonth.year);
  return `${monthName(yearMonth.month, 'short')} ${formatYear(yearMonth.year)}`;
}

/**
 * A span's ends to the precision the source has: "Feb – Apr 1955" when both
 * ends share a year and carry months, "Feb 1955 – Apr 1956" otherwise, a single
 * date when the ends coincide.
 */
export function formatYearMonthRange(start: YearMonth, end: YearMonth): string {
  if (start.year === end.year && start.month === end.month) {
    return formatYearMonthShort(start);
  }
  if (
    start.year === end.year &&
    start.month !== undefined &&
    end.month !== undefined
  ) {
    return `${monthName(start.month, 'short')} – ${formatYearMonthShort(end)}`;
  }
  if (start.month === undefined && end.month === undefined) {
    return formatYearRange(start.year, end.year);
  }
  return `${formatYearMonthShort(start)} – ${formatYearMonthShort(end)}`;
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
  startYear: number;
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

// Align labels to round historical years. Use 1 BCE as the sole era-boundary tick,
// which makes the adjacent BCE interval one year shorter.

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
