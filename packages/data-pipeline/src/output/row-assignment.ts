import {
  type ConflictEntry,
  estimateLabelWidthPx,
  type Milestone,
  type Period,
  type Person,
  POINT_LABEL_OFFSET_PX,
  POINT_RADIUS,
  REFERENCE_SCALE_PIXELS_PER_YEAR as REFERENCE_PIXELS_PER_YEAR,
  wrapMarkLabelLines,
  yearMonthToFractionalYear,
} from '@o-tempora/shared-types';

const MIN_ROW_GAP_PX = 8;

// A zero- or negative-width range (e.g. a missing end) can't pack as a bar, so
// it is widened to a minimum one-year span, as in packages/web's
// map-to-items.ts.
function ensureMinimumRangeWidthYears(
  startYear: number,
  endYear: number,
): number {
  return endYear <= startYear ? startYear + 1 : endYear;
}

interface RowInterval {
  id: string;
  startYear: number;
  endYear: number;
  fameScore: number;
}

// Despite the field names, callers pass pixel positions at the Reference Scale
// so label widths and the gap use the same units.
export function assignRows(
  items: RowInterval[],
  gap: number,
): Map<string, number> {
  const rowIntervals: RowInterval[][] = [];
  const rowOfId = new Map<string, number>();

  // Sort by rounded Fame Score first so removing a whole lower tier cannot
  // change higher-tier rows. Filtering inside one rounded tier has no such guarantee.
  const sorted = [...items].sort(
    (a, b) =>
      Math.round(b.fameScore) - Math.round(a.fameScore) ||
      a.startYear - b.startYear ||
      a.id.localeCompare(b.id),
  );
  for (const item of sorted) {
    const row = rowIntervals.findIndex((placed) =>
      placed.every(
        (existing) =>
          item.startYear >= existing.endYear + gap ||
          item.endYear + gap <= existing.startYear,
      ),
    );
    if (row === -1) {
      rowOfId.set(item.id, rowIntervals.length);
      rowIntervals.push([item]);
    } else {
      rowOfId.set(item.id, row);
      rowIntervals[row]?.push(item);
    }
  }

  return rowOfId;
}

// Reserve the widest label across languages so both locales can share rows.
type AltNames = ReadonlyMap<string, string>;

function widestNamePx(name: string, altName: string | undefined): number {
  return Math.max(
    estimateLabelWidthPx(name),
    altName === undefined ? 0 : estimateLabelWidthPx(altName),
  );
}

function altNamesById(
  entries: readonly { id: string; name: string }[],
): AltNames {
  return new Map(entries.map((entry) => [entry.id, entry.name]));
}

function personInterval(person: Person, altNames: AltNames): RowInterval {
  const startYear = yearMonthToFractionalYear(person.lifespan.start);
  // Missing lifespan.end means still alive: draw through to today, not a
  // zero-width bar at birth. The build-time "today" is fine since Row Depth only
  // needs rough consistency with the browser's, and rebuilds refresh it.
  const rawEndYear = person.lifespan.end
    ? yearMonthToFractionalYear(person.lifespan.end)
    : new Date().getUTCFullYear();
  const endYear = ensureMinimumRangeWidthYears(startYear, rawEndYear);
  const x1 = startYear * REFERENCE_PIXELS_PER_YEAR;
  const x2 = endYear * REFERENCE_PIXELS_PER_YEAR;
  const labelWidth = widestNamePx(person.name, altNames.get(person.id));
  return {
    id: person.id,
    startYear: x1,
    endYear: Math.max(x2, x1 + labelWidth),
    fameScore: person.fameScore,
  };
}

export function assignPersonRows(
  people: Person[],
  localizedPeople: Person[] = [],
): Map<string, number> {
  const altNames = altNamesById(localizedPeople);
  return assignRows(
    people.map((person) => personInterval(person, altNames)),
    MIN_ROW_GAP_PX,
  );
}

function labelWidthPx(name: string, altName: string | undefined): number {
  const widest = (n: string) =>
    Math.max(...wrapMarkLabelLines(n).map(estimateLabelWidthPx));
  return Math.max(widest(name), altName === undefined ? 0 : widest(altName));
}

function rangeInterval(
  name: string,
  altName: string | undefined,
  startYear: number,
  endYear: number,
): { start: number; end: number } {
  const x1 = startYear * REFERENCE_PIXELS_PER_YEAR;
  const x2 = endYear * REFERENCE_PIXELS_PER_YEAR;
  return { start: x1, end: Math.max(x2, x1 + labelWidthPx(name, altName)) };
}

function pointInterval(
  name: string,
  altName: string | undefined,
  startYear: number,
): { start: number; end: number } {
  const x = startYear * REFERENCE_PIXELS_PER_YEAR;
  return {
    start: x - POINT_RADIUS,
    end: x + POINT_LABEL_OFFSET_PX + labelWidthPx(name, altName),
  };
}

function eventInterval(
  entry: ConflictEntry | Milestone,
  altNames: AltNames,
): RowInterval {
  const isPeriod = 'period' in entry;
  const period: Period = isPeriod
    ? entry.period
    : { start: entry.at, end: undefined };
  const startYear = yearMonthToFractionalYear(period.start);
  const altName = altNames.get(entry.id);

  if (!isPeriod) {
    const { start, end } = pointInterval(entry.name, altName, startYear);
    return {
      id: entry.id,
      startYear: start,
      endYear: end,
      fameScore: entry.fameScore,
    };
  }

  const rawEndYear = period.end
    ? yearMonthToFractionalYear(period.end)
    : startYear;
  const endYear = ensureMinimumRangeWidthYears(startYear, rawEndYear);
  const { start, end } = rangeInterval(entry.name, altName, startYear, endYear);
  return {
    id: entry.id,
    startYear: start,
    endYear: end,
    fameScore: entry.fameScore,
  };
}

// Conflicts and Milestones share one row-packing pass: packages/web's merged
// ConflictsMilestonesLane renders both in one row space, so their permanent
// rows are assigned together, not per lane.
export function assignConflictsMilestonesRows(
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  localizedConflicts: ConflictEntry[] = [],
  localizedMilestones: Milestone[] = [],
): Map<string, number> {
  const altNames = altNamesById([
    ...localizedConflicts,
    ...localizedMilestones,
  ]);
  return assignRows(
    [...conflicts, ...milestones].map((entry) =>
      eventInterval(entry, altNames),
    ),
    MIN_ROW_GAP_PX,
  );
}
