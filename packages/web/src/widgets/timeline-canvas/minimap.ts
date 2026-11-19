import {
  type CenturyBoundary,
  centuryBoundariesInRange,
  formatYear,
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
import { buildXScale, MIN_YEAR, REFERENCE_PIXELS_PER_YEAR } from './options';

// Resolution of the bucketed Row Depth series: enough buckets to trace shape
// across ~4,800 years without a per-year sample.
export const MINIMAP_BUCKET_COUNT = 300;

export interface DensityProfile {
  years: number[];
  peopleDepth: number[];
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

// Rough per-character width for the century strip's 9px labels (see
// options.ts's AVG_CHAR_WIDTH_PX, tuned for 11px) plus breathing room; enough
// to bound label width for the thinning pass without DOM measurement.
const CENTURY_LABEL_CHAR_WIDTH_PX = 5;
const CENTURY_LABEL_GAP_PX = 6;

function estimateCenturyLabelWidthPx(label: string): number {
  return label.length * CENTURY_LABEL_CHAR_WIDTH_PX + CENTURY_LABEL_GAP_PX;
}

export interface CenturyStripTick {
  startYear: number;
  label: string;
  leftPercent: number;
  showLabel: boolean;
}

// Ticks at every century boundary across the pannable range, on the same
// REFERENCE_PIXELS_PER_YEAR scale as the Minimap's ridge so they line up with
// it. Labels use formatYear's numeric style ("1500", "100 BCE"), as YearAxis
// does, not centuryBoundaryForYear's ordinals. They thin out left to right,
// keeping a label only if it clears the previous shown label's rendered width;
// lengths vary ("1800" vs. "800 BCE"), so a flat gap like YearAxis's
// MIN_DECADE_LABEL_SPACING_PX would overlap.
export function centuryStripTicks(trackWidthPx: number): CenturyStripTick[] {
  const { scale: refScale, totalWidth: refTotalWidthPx } = buildXScale(
    REFERENCE_PIXELS_PER_YEAR,
  );
  if (refTotalWidthPx <= 0) return [];
  const [, domainMaxYear] = refScale.domain();
  let lastLabelRightEdgePx = -Infinity;
  return centuryTicksInRange(MIN_YEAR, domainMaxYear ?? MIN_YEAR).map(
    (boundary) => {
      const label = formatYear(boundary.startYear);
      const leftPercent =
        (refScale(boundary.startYear) / refTotalWidthPx) * 100;
      const xPx = (leftPercent / 100) * trackWidthPx;
      // Labels are centered under their tick (translateX(-50%)), so collisions
      // are checked on each label's half-widths, not its x position.
      const halfWidthPx = estimateCenturyLabelWidthPx(label) / 2;
      const showLabel = xPx - halfWidthPx >= lastLabelRightEdgePx;
      if (showLabel) lastLabelRightEdgePx = xPx + halfWidthPx;
      return { startYear: boundary.startYear, label, leftPercent, showLabel };
    },
  );
}
