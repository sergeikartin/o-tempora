import type { BandOverlap, BandSpan } from './SelectionBands';

interface SelectionFocusInput {
  spans: readonly BandSpan[];
  overlap: BandOverlap | null;
}

// The years the Focus Range heading names for a Selection: the one member's own
// span, or the span several members share (flagged by isOverlap so the heading
// can say so). Null when nothing is selected or
// several members share no span, so the heading falls back to the visible
// years. Floored because a fractional year carries its month: a death in
// December 1821 is still 1821.
export function selectionFocusYears(
  bands: SelectionFocusInput | null | undefined,
): { startYear: number; endYear: number; isOverlap: boolean } | null {
  if (!bands) return null;
  const isOverlap = bands.spans.length > 1;
  const years = isOverlap ? bands.overlap : bands.spans[0];
  if (!years) return null;
  return {
    startYear: Math.floor(years.startYear),
    endYear: Math.floor(years.endYear),
    isOverlap,
  };
}
