import { formatYearMonth, formatYearRange } from '../../shared/lib/date';
import styles from './FocusRange.module.css';

interface FocusRangeProps {
  startApproximate?: true;
  endApproximate?: true;
  startYear: number;
  endYear: number;
}

export function FocusRange({
  startYear,
  endYear,
  startApproximate,
  endApproximate,
}: FocusRangeProps) {
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
      {start === end && startApproximate === endApproximate
        ? formatYearMonth({ year: start, approximate: startApproximate })
        : formatYearRange(start, end, startApproximate, endApproximate)}
    </div>
  );
}
