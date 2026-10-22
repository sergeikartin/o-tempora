import { formatYearRange } from '../../shared/lib/date';
import styles from './ViewportRange.module.css';

interface ViewportRangeProps {
  startYear: number;
  endYear: number;
}

export function ViewportRange({ startYear, endYear }: ViewportRangeProps) {
  return (
    // The build-time prerender's inline script rewrites this text from the
    // visitor's real clientWidth before first paint (vite-plugins/
    // prerender-default-viewport.ts), so it legitimately differs from the
    // hydration render's fallback-width value.
    <div
      className={styles.viewportRange}
      aria-hidden="true"
      suppressHydrationWarning
    >
      {formatYearRange(Math.round(startYear), Math.round(endYear))}
    </div>
  );
}
