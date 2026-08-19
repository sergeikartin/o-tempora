import { test, expect } from 'vitest';
import { centuryTicksInRange, computeDensityProfile, logScaleHeightPx } from './minimap';
import { computeStaticConflictsMilestonesRows, computeStaticPersonRows } from './map-to-items';
import { PAN_MIN_DATE } from '../../shared/config';
import { today } from '../../shared/lib/dates';
import { centuryBoundariesInRange } from '../../shared/lib/format-year';
import type { ConflictEntry, Milestone, Person } from '../../shared/types';

const REFERENCE_PIXELS_PER_YEAR = 8;

// Test-only helper mirroring TimelineCanvas: computeDensityProfile expects
// the same static row-of maps the real lanes render with, narrowed to
// whatever's passed in via compactRows — since none of these tests filter
// their input, that's the entire, unfiltered set every time.
function profileFor(people: Person[], conflicts: ConflictEntry[], milestones: Milestone[]) {
  return computeDensityProfile(
    people,
    conflicts,
    milestones,
    REFERENCE_PIXELS_PER_YEAR,
    computeStaticPersonRows(people),
    computeStaticConflictsMilestonesRows(conflicts, milestones),
  );
}

function person(id: string, startYear: number, endYear: number, fameScore = 90): Person {
  return {
    id,
    name: id,
    lifespan: { start: { year: startYear }, end: { year: endYear } },
    occupationDomain: 'humanities',
    regionTags: [],
    fameScore,
    tagline: '',
    wikipediaUrl: '',
  };
}

test('computeDensityProfile returns an all-zero profile spanning the pannable domain when given no entities', () => {
  const profile = profileFor([], [], []);
  expect(profile.peopleDepth.every((depth) => depth === 0)).toBe(true);
  expect(profile.eventsDepth.every((depth) => depth === 0)).toBe(true);
  // Each bucket's reported year is its midpoint, not its left edge, so the
  // first/last bucket sit half a bucket-width inside the domain's true
  // bounds rather than exactly on them.
  const bucketWidthYears = (today().year - PAN_MIN_DATE.year) / profile.years.length;
  expect(profile.years[0]).toBeGreaterThanOrEqual(PAN_MIN_DATE.year);
  expect(profile.years[0]).toBeLessThan(PAN_MIN_DATE.year + bucketWidthYears);
  expect(profile.years[profile.years.length - 1]).toBeLessThanOrEqual(today().year);
  expect(profile.years[profile.years.length - 1]).toBeGreaterThan(today().year - bucketWidthYears);
});

test('computeDensityProfile marks depth 1 across a single person\'s full lifespan bucket range', () => {
  const profile = profileFor([person('a', 1000, 1050)], [], []);
  const withinLifespan = profile.years
    .map((year, i) => ({ year, depth: profile.peopleDepth[i] ?? 0 }))
    .filter((entry) => entry.year > 1000 && entry.year < 1050);
  expect(withinLifespan.length).toBeGreaterThan(0);
  expect(withinLifespan.every((entry) => entry.depth === 1)).toBe(true);
  const outsideLifespan = profile.peopleDepth[0] ?? 0;
  expect(outsideLifespan).toBe(0);
});

test('computeDensityProfile raises People depth to 2 where two lifespans overlap, keeping 1 where only one does', () => {
  const overlapping = [person('a', 1000, 1100), person('b', 1050, 1150)];
  const profile = profileFor(overlapping, [], []);
  const depthAtYear = (year: number) => {
    const bucket = profile.years.reduce((closest, candidate, i) => {
      const closestYear = profile.years[closest] ?? 0;
      return Math.abs(candidate - year) < Math.abs(closestYear - year) ? i : closest;
    }, 0);
    return profile.peopleDepth[bucket] ?? 0;
  };
  expect(depthAtYear(1075)).toBe(2); // both lifespans active
  expect(depthAtYear(1020)).toBe(1); // only 'a'
});

test("computeDensityProfile's eventsDepth reflects the merged Conflicts+Milestones row packing, not two independent series", () => {
  const conflict = {
    id: 'c1',
    name: 'War',
    period: { start: { year: 1500 }, end: { year: 1510 } },
    category: 'war' as const,
    regionTags: [],
    fameScore: 90,
    tagline: '',
    wikipediaUrl: '',
  };
  const milestone = {
    id: 'm1',
    name: 'Invention',
    at: { year: 1503 },
    category: 'science-theory' as const,
    regionTags: [],
    fameScore: 90,
    tagline: '',
    wikipediaUrl: '',
  };
  const profile = profileFor([], [conflict], [milestone]);
  expect(Math.max(...profile.eventsDepth)).toBe(2); // they collide and stack into two rows
});

test("computeDensityProfile's People depth reflects each person's compacted static row, not a fresh assignRows over just the filtered subset", () => {
  // Statically (full dataset), 'a' (fame 100) claims row 0. 'b' (fame 90)
  // overlaps 'a' and is bumped to row 1. 'c' (fame 80) doesn't overlap 'a'
  // and reuses row 0.
  const all = [person('a', 1000, 1010, 100), person('b', 1005, 1015, 90), person('c', 1030, 1040, 80)];
  const staticPersonRowOf = computeStaticPersonRows(all);
  // Now filter 'a' out, as e.g. a fame-score filter would. A fresh
  // assignRows call over just [b, c] would give both row 0 (they never
  // overlap each other) — the bug this guards against. The real PeopleLane
  // instead compacts the *static* rows {b: 1, c: 0} down to {b: 1, c: 0}
  // (already contiguous here), keeping 'b' on its own row, so Row Depth
  // during 'b''s span must stay 2, not collapse to 1.
  const filtered = [all[1] as Person, all[2] as Person];
  const profile = computeDensityProfile(
    filtered,
    [],
    [],
    REFERENCE_PIXELS_PER_YEAR,
    staticPersonRowOf,
    computeStaticConflictsMilestonesRows([], []),
  );
  const depthAtYear = (year: number) => {
    const bucket = profile.years.reduce((closest, candidate, i) => {
      const closestYear = profile.years[closest] ?? 0;
      return Math.abs(candidate - year) < Math.abs(closestYear - year) ? i : closest;
    }, 0);
    return profile.peopleDepth[bucket] ?? 0;
  };
  expect(depthAtYear(1008)).toBe(2);
});

test('logScaleHeightPx returns 0 at depth 0 and maxHeightPx at the maximum depth', () => {
  expect(logScaleHeightPx(0, 30, 50)).toBe(0);
  expect(logScaleHeightPx(30, 30, 50)).toBeCloseTo(50);
});

test('centuryTicksInRange drops a boundary whose true start precedes minYear, but keeps the next one', () => {
  const rawBoundaries = centuryBoundariesInRange(PAN_MIN_DATE.year, PAN_MIN_DATE.year + 200);
  const ticks = centuryTicksInRange(PAN_MIN_DATE.year, PAN_MIN_DATE.year + 200);
  // The real PAN_MIN_DATE doesn't land exactly on a century boundary, so
  // centuryBoundariesInRange's first entry starts before it — exactly the
  // case centuryTicksInRange exists to filter out, without dropping the
  // boundary right after it too.
  expect(rawBoundaries[0]?.startYear).toBeLessThan(PAN_MIN_DATE.year);
  expect(ticks.every((boundary) => boundary.startYear >= PAN_MIN_DATE.year)).toBe(true);
  expect(ticks[0]).toEqual(rawBoundaries[1]);
});

test('centuryTicksInRange returns boundaries in ascending order with no gaps', () => {
  const ticks = centuryTicksInRange(1700, 2026);
  const startYears = ticks.map((boundary) => boundary.startYear);
  expect(startYears).toEqual([...startYears].sort((a, b) => a - b));
  for (let i = 1; i < ticks.length; i += 1) {
    expect(ticks[i]?.startYear).toBe((ticks[i - 1]?.endYear ?? 0) + 1);
  }
});

test('logScaleHeightPx compresses the dynamic range so a low depth stays visually non-flat next to a high one', () => {
  const maxDepth = 30;
  const maxHeightPx = 50;
  const lowHeight = logScaleHeightPx(2, maxDepth, maxHeightPx);
  const highHeight = logScaleHeightPx(maxDepth, maxDepth, maxHeightPx);
  // Under a linear scale, depth 2 of 30 would render at ~6.7% height —
  // log1p compresses the gap enough that it renders well above that.
  expect(lowHeight / highHeight).toBeGreaterThan(2 / maxDepth);
});
