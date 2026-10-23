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
import { buildXScale } from './options';

// Resolution of the bucketed Row Depth series: enough buckets to trace shape
// across ~4,800 years without a per-year sample.
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

// Row Depth at a bucket is 1 + the highest row index of any item overlapping
// it, the number of stacked rows needed to render that span without collision,
// not a count of items. `rowOf` must be the live lanes' per-item row
// assignment (see computeDensityProfile) so the depth matches the canvas.
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
 * rather than the caller's live zoom (web/docs/adr/0004). `personRowFor`/
 * `eventsRowFor` must be the live lanes' resolvers (map-to-items.ts's
 * computeRowAssignment), fed this profile's own ids; a fresh assignRows pass
 * on the filtered subset would disagree with the canvas whenever a filter
 * narrows the dataset (web/docs/adr/0007's addendum).
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
      const { start, end } = milestonePixelInterval(item, refScale);
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
 * Century boundaries whose start falls within [minYear, maxYear]. Unlike
 * centuryBoundariesInRange, which includes the century containing minYear
 * even when its start precedes minYear (a tick off the left edge, at
 * negative x). Powers the Minimap's century-tick strip.
 */
export function centuryTicksInRange(
  minYear: number,
  maxYear: number,
): CenturyBoundary[] {
  return centuryBoundariesInRange(minYear, maxYear).filter(
    (boundary) => boundary.startYear >= minYear,
  );
}

// Depth is log1p-scaled so low-density eras stay visible: linear would render
// depth 2 next to depth 30 at ~7% height; log1p gives ~20% vs. 100%.
export function logScaleHeightPx(
  depth: number,
  maxDepth: number,
  maxHeightPx: number,
): number {
  if (maxDepth <= 0 || depth <= 0) return 0;
  return (Math.log1p(depth) / Math.log1p(maxDepth)) * maxHeightPx;
}
