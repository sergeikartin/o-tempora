import type { ConflictEntry, Milestone, Person } from '../../shared/types';
import {
  assignRows,
  conflictPixelInterval,
  mapConflicts,
  mapMilestones,
  mapPeople,
  milestonePixelInterval,
  personPixelInterval,
} from './map-to-items';
import { buildXScale, MILESTONES_LABEL_MAX_WIDTH_PX, MIN_ROW_GAP_PX, wrapLabelLines } from './options';

// Resolution of the Mountain Profile's bucketed Row Depth series — enough
// buckets to trace real shape across a ~4,800-year domain without paying for
// a per-year sample.
export const MOUNTAIN_PROFILE_BUCKET_COUNT = 300;

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
  fameScore: number;
}

// Row Depth at a bucket is 1 + the highest row index any item overlapping
// that bucket was greedily assigned to by assignRows — not just a count of
// overlapping items — since that's the actual number of stacked rows a lane
// needs to render that span without collision.
function bucketDepths(intervals: DepthInterval[], refTotalWidth: number, bucketCount: number): number[] {
  const depths = new Array<number>(bucketCount).fill(0);
  if (refTotalWidth <= 0) return depths;
  const rowOf = assignRows(intervals, MIN_ROW_GAP_PX);
  const bucketWidthPx = refTotalWidth / bucketCount;
  for (const interval of intervals) {
    const row = rowOf.get(interval.id) ?? 0;
    const startBucket = Math.min(bucketCount - 1, Math.max(0, Math.floor(interval.startYear / bucketWidthPx)));
    const endBucket = Math.min(bucketCount - 1, Math.max(0, Math.floor(interval.endYear / bucketWidthPx)));
    for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
      depths[bucket] = Math.max(depths[bucket] ?? 0, row + 1);
    }
  }
  return depths;
}

/**
 * Row Depth across the full pannable domain (People, and the merged
 * Conflicts+Milestones lane), computed once at a fixed Reference Scale
 * rather than the caller's live zoom (ADR 0004) — reuses assignRows' same
 * pixel-interval packing every lane already uses, just run over the whole
 * domain instead of the visible viewport.
 */
export function computeDensityProfile(
  people: Person[],
  conflicts: ConflictEntry[],
  milestones: Milestone[],
  referencePixelsPerYear: number,
  bucketCount: number = MOUNTAIN_PROFILE_BUCKET_COUNT,
): DensityProfile {
  const { scale: refScale, totalWidth: refTotalWidth } = buildXScale(referencePixelsPerYear);

  const peopleIntervals: DepthInterval[] = mapPeople(people).map((item) => {
    const { start, end } = personPixelInterval(item, refScale);
    return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
  });

  const conflictItems = mapConflicts(conflicts);
  const milestoneItems = mapMilestones(milestones);
  const eventIntervals: DepthInterval[] = [
    ...conflictItems.map((item) => {
      const { start, end } = conflictPixelInterval(item, refScale);
      return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
    }),
    ...milestoneItems.map((item) => {
      const lines = wrapLabelLines(item.name, MILESTONES_LABEL_MAX_WIDTH_PX);
      const { start, end } = milestonePixelInterval(item, lines, refScale);
      return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
    }),
  ];

  const years = Array.from({ length: bucketCount }, (_, bucket) =>
    refScale.invert(((bucket + 0.5) / bucketCount) * refTotalWidth),
  );

  return {
    years,
    peopleDepth: bucketDepths(peopleIntervals, refTotalWidth, bucketCount),
    eventsDepth: bucketDepths(eventIntervals, refTotalWidth, bucketCount),
  };
}

// Depth is log1p-scaled (not linear) so low-density eras stay visually
// non-flat against high-density ones — under a linear scale, a depth of 2
// next to a depth of 30 would render at ~7% height, all but invisible;
// log1p compresses that same pair to ~20% vs. 100%.
export function logScaleHeightPx(depth: number, maxDepth: number, maxHeightPx: number): number {
  if (maxDepth <= 0 || depth <= 0) return 0;
  return (Math.log1p(depth) / Math.log1p(maxDepth)) * maxHeightPx;
}
