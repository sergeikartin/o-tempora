import {
  estimateLabelWidthPx,
  POINT_LABEL_OFFSET_PX,
  POINT_RADIUS,
  REFERENCE_SCALE_PIXELS_PER_YEAR as REFERENCE_PIXELS_PER_YEAR,
  wrapMarkLabelLines,
  yearMonthToFractionalYear,
  type ConflictEntry,
  type Milestone,
  type Period,
  type Person,
} from "@o-tempora/shared-types";

// Row-stacking gap in the same pixel space as REFERENCE_PIXELS_PER_YEAR —
// a pipeline-only value (nothing in packages/web packs rows anymore, so
// there's nothing to keep it in sync with; see assignRows below for why the
// scale's origin (MIN_YEAR) doesn't matter, only the per-year factor).
const MIN_ROW_GAP_PX = 8;

// A zero- or negative-width range (e.g. a missing end) can't pack as a
// visible bar — widen it to a minimum one-year span, the same rule
// packages/web's map-to-items.ts applies for live rendering.
function ensureMinimumRangeWidthYears(startYear: number, endYear: number): number {
  return endYear <= startYear ? startYear + 1 : endYear;
}

interface RowInterval {
  id: string;
  startYear: number;
  endYear: number;
  fameScore: number;
}

// Fame-priority interval-graph row assignment, ported verbatim from
// packages/web's former map-to-items.ts (see docs/adr/0005-row-assignment-
// moves-to-the-pipeline.md for why it moved here): processes items by fame
// *tier* — fameScore rounded to the nearest integer, descending — rather
// than chronologically, greedily dropping each into the lowest-numbered row
// that's free of it (with `gap` breathing room) anywhere in its span. The
// most famous tier claims row 0 first and keeps it as long as nothing later
// conflicts with it, so row 0 accumulates the highest-fame tier and each
// successive row skews progressively less famous. Field names read as
// years, but the algorithm is purely numeric — every caller below passes
// pixel-space positions at REFERENCE_PIXELS_PER_YEAR.
export function assignRows(items: RowInterval[], gap: number): Map<string, number> {
  const rowIntervals: RowInterval[][] = [];
  const rowOfId = new Map<string, number>();

  // Tier must stay the primary sort key: a lower-tier item is always
  // processed after every higher-tier item, so it can never occupy a row a
  // higher-tier item needs — dropping a whole tier from the input changes
  // nothing about the rows of what's left (`packages/web/docs/adr/0007-
  // static-row-assignment-replaces-live-per-render-packing.md`'s Why
  // section). That guarantee is per-tier only, not per-raw-score: two
  // same-tier items are ordered by the startYear/id tie-break below, so a
  // floor that splits a tier (e.g. fameScore>=88 inside tier 88's
  // [87.5, 88.5) range) can shift a surviving same-tier item's row — see
  // this file's test `assignRows can shift a same-tier survivor's row when
  // a floor splits its tier`. Reordering these sort keys, or adding a new
  // primary key ahead of tier (e.g. to group by category), breaks the
  // guarantee ADR 0007 depends on.
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
          item.startYear >= existing.endYear + gap || item.endYear + gap <= existing.startYear,
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

// Rows are language-independent (one row per entity, shared by every
// language build), so a label's footprint is its widest rendering across
// languages. `altNames` maps id → the other language's name.
type AltNames = ReadonlyMap<string, string>;

function widestNamePx(name: string, altName: string | undefined): number {
  return Math.max(estimateLabelWidthPx(name), altName === undefined ? 0 : estimateLabelWidthPx(altName));
}

function altNamesById(entries: readonly { id: string; name: string }[]): AltNames {
  return new Map(entries.map((entry) => [entry.id, entry.name]));
}

function personInterval(person: Person, altNames: AltNames): RowInterval {
  const startYear = yearMonthToFractionalYear(person.lifespan.start);
  // Missing lifespan.end means still alive — draw through to today, not a
  // collapsed zero-width bar at their birth year. Using the pipeline's own
  // build-time "today" rather than a live one is fine: Row Depth only needs
  // to be roughly consistent, not pixel-exact with whatever "today" the
  // browser renders with, and a rebuild refreshes it periodically anyway.
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

export function assignPersonRows(people: Person[], localizedPeople: Person[] = []): Map<string, number> {
  const altNames = altNamesById(localizedPeople);
  return assignRows(
    people.map((person) => personInterval(person, altNames)),
    MIN_ROW_GAP_PX,
  );
}

function labelWidthPx(name: string, altName: string | undefined): number {
  const widest = (n: string) => Math.max(...wrapMarkLabelLines(n).map(estimateLabelWidthPx));
  return Math.max(widest(name), altName === undefined ? 0 : widest(altName));
}

// A period's label hangs below its line, left-aligned to its start.
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

// A point's label sits to the right of its dot, on the same line.
function pointInterval(
  name: string,
  altName: string | undefined,
  startYear: number,
): { start: number; end: number } {
  const x = startYear * REFERENCE_PIXELS_PER_YEAR;
  return { start: x - POINT_RADIUS, end: x + POINT_LABEL_OFFSET_PX + labelWidthPx(name, altName) };
}

function eventInterval(
  entry: ConflictEntry | Milestone,
  altNames: AltNames,
): RowInterval {
  const isPeriod = "period" in entry;
  const period: Period = isPeriod ? entry.period : { start: entry.at, end: undefined };
  const startYear = yearMonthToFractionalYear(period.start);
  const altName = altNames.get(entry.id);

  if (!isPeriod) {
    const { start, end } = pointInterval(entry.name, altName, startYear);
    return { id: entry.id, startYear: start, endYear: end, fameScore: entry.fameScore };
  }

  const rawEndYear = period.end ? yearMonthToFractionalYear(period.end) : startYear;
  const endYear = ensureMinimumRangeWidthYears(startYear, rawEndYear);
  const { start, end } = rangeInterval(entry.name, altName, startYear, endYear);
  return { id: entry.id, startYear: start, endYear: end, fameScore: entry.fameScore };
}

// Conflicts and Milestones share one row-packing pass — packages/web's
// merged ConflictsMilestonesLane renders both in one shared row space, so
// their permanent rows have to be assigned together, not per-lane.
export function assignConflictsMilestonesRows(
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  localizedConflicts: ConflictEntry[] = [],
  localizedMilestones: Milestone[] = [],
): Map<string, number> {
  const altNames = altNamesById([...localizedConflicts, ...localizedMilestones]);
  return assignRows(
    [...conflicts, ...milestones].map((entry) => eventInterval(entry, altNames)),
    MIN_ROW_GAP_PX,
  );
}
