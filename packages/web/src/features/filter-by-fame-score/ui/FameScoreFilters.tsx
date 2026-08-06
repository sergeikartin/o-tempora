import type { ChangeEvent } from 'react';
import { FAME_SCORE_BOUNDS, FAME_SCORE_LANES } from '../../../shared/config';
import type { FameScoreLane, FameScoreValues } from '../model/useFameScoreFilters';
import styles from './FameScoreFilters.module.css';

// Display labels only — bounds/defaults are shared/config's FAME_SCORE_BOUNDS.
const LANE_LABELS: Record<FameScoreLane, string> = {
  people: 'People',
  wars: 'Wars & Conflicts',
  discoveries: 'Events & Inventions',
};

interface FameScoreFiltersProps {
  values: FameScoreValues;
  onChange: (lane: FameScoreLane, value: number) => void;
}

// One raw-fameScore numeric floor per lane, directly settable by the user —
// replaces the old zoom-coupled Fame Tier system (ADR 0003). Session-only:
// no persistence, state lives in useFameScoreFilters and resets on reload.
export function FameScoreFilters({ values, onChange }: FameScoreFiltersProps) {
  return (
    <div className={styles.filters}>
      {FAME_SCORE_LANES.map((lane) => {
        const { min, max } = FAME_SCORE_BOUNDS[lane];
        const label = LANE_LABELS[lane];
        return (
          <label key={lane} className={styles.filter}>
            <span className={styles.filterLabel}>{label}</span>
            <input
              type="number"
              className={styles.filterInput}
              min={min}
              max={max}
              step={1}
              value={values[lane]}
              aria-label={`Minimum fame score for ${label}`}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(lane, Number(event.target.value))}
            />
          </label>
        );
      })}
    </div>
  );
}
