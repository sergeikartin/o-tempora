import type { YearSpan } from '../../shared/lib/entity';

export function selectionFocusYears(span: YearSpan | null): YearSpan | null {
  if (!span) return null;
  return {
    startYear: Math.floor(span.startYear),
    endYear: Math.floor(span.endYear),
  };
}
