import { formatYear, formatYearRange } from '../../shared/lib/date';
import { m } from '../../shared/paraglide/messages.js';
import styles from './FocusRange.module.css';

interface FocusRangeProps {
  startYear: number;
  endYear: number;
  // The years are the span the Selection's members share, not one member's.
  isOverlap: boolean;
}

export function FocusRange({ startYear, endYear, isOverlap }: FocusRangeProps) {
  const start = Math.round(startYear);
  const end = Math.round(endYear);
  return (
    // The build-time prerender's inline script rewrites this text from the
    // visitor's real clientWidth before first paint (vite-plugins/
    // prerender-default-viewport.ts), so it legitimately differs from the
    // hydration render's fallback-width value.
    <div
      className={styles.focusRange}
      aria-hidden="true"
      suppressHydrationWarning
    >
      {isOverlap && (
        <span className={styles.overlapLabel}>
          {m.focusRangeOverlapLabel()}
        </span>
      )}
      {start === end ? formatYear(start) : formatYearRange(start, end)}
    </div>
  );
}
