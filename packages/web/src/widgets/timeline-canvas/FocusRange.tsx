import { formatYear, formatYearRange } from '../../shared/lib/date';
import styles from './FocusRange.module.css';

interface FocusRangeProps {
  startYear: number;
  endYear: number;
}

export function FocusRange({ startYear, endYear }: FocusRangeProps) {
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
      {start === end ? formatYear(start) : formatYearRange(start, end)}
    </div>
  );
}
