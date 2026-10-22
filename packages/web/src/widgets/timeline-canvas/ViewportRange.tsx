import { formatYearRange } from '../../shared/lib/date';
import styles from './ViewportRange.module.css';

interface ViewportRangeProps {
  startYear: number;
  endYear: number;
}

export function ViewportRange({ startYear, endYear }: ViewportRangeProps) {
  return (
    <div className={styles.viewportRange} aria-hidden="true">
      {formatYearRange(Math.round(startYear), Math.round(endYear))}
    </div>
  );
}
