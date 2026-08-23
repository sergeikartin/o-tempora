export function today(): number {
  return new Date().getFullYear();
}

// Re-exported from shared-types rather than defined here — data-pipeline
// needs the exact same projection when precomputing TimelineEntry.row
// (docs/adr/0005-row-assignment-moves-to-the-pipeline.md), so it's defined
// once, in the one place both packages already depend on.
export { yearMonthToFractionalYear } from '../../types';
