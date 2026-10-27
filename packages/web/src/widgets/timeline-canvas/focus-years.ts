import type { YearSpan } from '../../shared/lib/entity';

// The years the Focus Range heading names for the Selection: the selected
// entity's own span, or null when nothing is selected so the heading falls back
// to the visible years. Floored because a fractional year carries its month: a
// death in December 1821 is still 1821.
export function selectionFocusYears(span: YearSpan | null): YearSpan | null {
  if (!span) return null;
  return {
    startYear: Math.floor(span.startYear),
    endYear: Math.floor(span.endYear),
  };
}
