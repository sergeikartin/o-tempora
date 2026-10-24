import type { BandOverlap, BandSpan } from './SelectionBands';

interface SelectionFocusInput {
  spans: readonly BandSpan[];
  overlap: BandOverlap | null;
}

// The years the Focus Range heading names for a Selection: the one member's own
// span, or the span several members share. Null when nothing is selected or
// several members share no span, so the heading falls back to the visible
// years. Floored because a fractional year carries its month: a death in
// December 1821 is still 1821.
export function selectionFocusYears(
  bands: SelectionFocusInput | null | undefined,
): { startYear: number; endYear: number } | null {
  if (!bands) return null;
  const years =
    bands.spans.length === 1 ? bands.spans[0] : (bands.overlap ?? null);
  if (!years) return null;
  return {
    startYear: Math.floor(years.startYear),
    endYear: Math.floor(years.endYear),
  };
}
