// Every year in the rendering path is a plain signed integer using
// Temporal's ISO/astronomical numbering (year 0 is 1 BCE, year 1 is 1 CE —
// see packages/shared-types's TimelineEntry comment). This is the one place
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
function centuryBoundaryForYear(year: number): CenturyBoundary {
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
export function centuryBoundariesInRange(startYear: number, endYear: number): CenturyBoundary[] {
  const boundaries: CenturyBoundary[] = [];
  let cursor = startYear;
  while (cursor <= endYear) {
    const boundary = centuryBoundaryForYear(cursor);
    boundaries.push(boundary);
    cursor = boundary.endYear + 1;
  }
  return boundaries;
}
