import {
  type CenturyBoundary,
  centuryBoundariesInRange,
} from '../../shared/lib/date';
import type { ConflictEntry, Milestone, Person } from '../../shared/types';
import {
  conflictPixelInterval,
  mapConflicts,
  mapMilestones,
  mapPeople,
  milestonePixelInterval,
  personPixelInterval,
} from './map-to-items';
import {
  buildXScale,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  wrapLabelLines,
} from './options';

// Resolution of the Minimap's bucketed Row Depth series — enough
// buckets to trace real shape across a ~4,800-year domain without paying for
// a per-year sample.
export const MINIMAP_BUCKET_COUNT = 300;

export interface DensityProfile {
  /** Year at each bucket's midpoint, ascending, one per bucket. */
  years: number[];
  /** Row Depth per bucket, People lane. */
  peopleDepth: number[];
  /** Row Depth per bucket, merged Conflicts+Milestones lane. */
  eventsDepth: number[];
}

interface DepthInterval {
  id: string;
  startYear: number;
  endYear: number;
}

// Row Depth at a bucket is 1 + the highest row index any item overlapping
// that bucket occupies — not just a count of overlapping items — since
// that's the actual number of stacked rows a lane needs to render that span
// without collision. `rowOf` must be the same per-item row assignment the
// live lanes render with (see computeDensityProfile) so the Minimap's
// reported depth always matches what's actually on canvas.
function bucketDepths(
  intervals: DepthInterval[],
  rowOf: Map<string, number>,
  refTotalWidth: number,
  bucketCount: number,
): number[] {
  const depths = new Array<number>(bucketCount).fill(0);
  if (refTotalWidth <= 0) return depths;
  const bucketWidthPx = refTotalWidth / bucketCount;
  for (const interval of intervals) {
    const row = rowOf.get(interval.id) ?? 0;
    const startBucket = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(interval.startYear / bucketWidthPx)),
    );
    const endBucket = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(interval.endYear / bucketWidthPx)),
    );
    for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
      depths[bucket] = Math.max(depths[bucket] ?? 0, row + 1);
    }
  }
  return depths;
}

/**
 * Row Depth across the full pannable domain (People, and the merged
 * Conflicts+Milestones lane), computed once at a fixed Reference Scale
 * rather than the caller's live zoom (ADR 0004). `personRowFor`/
 * `eventsRowFor` must be the same Row Depth resolvers the live lanes render
 * with (map-to-items.ts's computeRowAssignment) — passing this profile's
 * own `people`/`conflicts`/`milestones` ids through them, rather than
 * running a fresh assignRows pass on this filtered subset, is what keeps
 * the Minimap's reported Row Depth from disagreeing with what's really on
 * canvas whenever a filter is narrowing the dataset (see ADR 0007's
 * addendum).
 */
export function computeDensityProfile(
  people: Person[],
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  referencePixelsPerYear: number,
  personRowFor: (ids: string[]) => Map<string, number>,
  eventsRowFor: (ids: string[]) => Map<string, number>,
  bucketCount: number = MINIMAP_BUCKET_COUNT,
): DensityProfile {
  const { scale: refScale, totalWidth: refTotalWidth } = buildXScale(
    referencePixelsPerYear,
  );

  const peopleItems = mapPeople(people);
  const peopleIntervals: DepthInterval[] = peopleItems.map((item) => {
    const { start, end } = personPixelInterval(item, refScale);
    return { id: item.id, startYear: start, endYear: end };
  });
  const peopleRowOf = personRowFor(peopleItems.map((item) => item.id));

  const conflictItems = mapConflicts(conflicts);
  const milestoneItems = mapMilestones(milestones);
  const eventIntervals: DepthInterval[] = [
    ...conflictItems.map((item) => {
      const { start, end } = conflictPixelInterval(item, refScale);
      return { id: item.id, startYear: start, endYear: end };
    }),
    ...milestoneItems.map((item) => {
      const lines = wrapLabelLines(item.name, MILESTONES_LABEL_MAX_WIDTH_PX);
      const { start, end } = milestonePixelInterval(item, lines, refScale);
      return { id: item.id, startYear: start, endYear: end };
    }),
  ];
  const eventsRowOf = eventsRowFor([
    ...conflictItems.map((item) => item.id),
    ...milestoneItems.map((item) => item.id),
  ]);

  const years = Array.from({ length: bucketCount }, (_, bucket) =>
    refScale.invert(((bucket + 0.5) / bucketCount) * refTotalWidth),
  );

  return {
    years,
    peopleDepth: bucketDepths(
      peopleIntervals,
      peopleRowOf,
      refTotalWidth,
      bucketCount,
    ),
    eventsDepth: bucketDepths(
      eventIntervals,
      eventsRowOf,
      refTotalWidth,
      bucketCount,
    ),
  };
}

/**
 * Century boundaries whose start actually falls within [minYear, maxYear] —
 * unlike centuryBoundariesInRange itself, which always includes the century
 * minYear happens to sit inside, even when that century's true start
 * precedes minYear (it would place a tick off the Minimap's left edge, at a
 * negative x). Powers the Minimap's top-edge century-tick strip
 * (`/grill-with-docs`).
 */
export function centuryTicksInRange(
  minYear: number,
  maxYear: number,
): CenturyBoundary[] {
  return centuryBoundariesInRange(minYear, maxYear).filter(
    (boundary) => boundary.startYear >= minYear,
  );
}

// Depth is log1p-scaled (not linear) so low-density eras stay visually
// non-flat against high-density ones — under a linear scale, a depth of 2
// next to a depth of 30 would render at ~7% height, all but invisible;
// log1p compresses that same pair to ~20% vs. 100%.
export function logScaleHeightPx(
  depth: number,
  maxDepth: number,
  maxHeightPx: number,
): number {
  if (maxDepth <= 0 || depth <= 0) return 0;
  return (Math.log1p(depth) / Math.log1p(maxDepth)) * maxHeightPx;
}
