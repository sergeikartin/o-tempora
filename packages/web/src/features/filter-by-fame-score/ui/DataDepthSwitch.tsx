import {
  DATA_DEPTH_LEVELS,
  FAME_SCORE_LANES,
  matchDataDepthLevel,
} from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import type {
  FameScoreLane,
  FameScoreValues,
} from '../model/useFameScoreFilters';
import styles from './DataDepthSwitch.module.css';

interface DataDepthSwitchProps {
  values: FameScoreValues;
  onChange: (lane: FameScoreLane, value: number) => void;
}

// Two-position preset that writes canonical values into the three
// numeric fame-score inputs below it (grill-with-docs session 2026-08-18).
// No separate "active level" state — the highlighted option is derived
// straight from `values` each render, so a hand-edited numeric input
// automatically drops the switch to no option shown as active ("custom").
export function DataDepthSwitch({ values, onChange }: DataDepthSwitchProps) {
  const activeLevelId = matchDataDepthLevel(values);

  function selectLevel(levelValues: Record<FameScoreLane, number>) {
    for (const lane of FAME_SCORE_LANES) onChange(lane, levelValues[lane]);
  }

  return (
    <div
      className={styles.switch}
      role="group"
      aria-label={m.dataDepthAriaLabel()}
    >
      {DATA_DEPTH_LEVELS.map((level) => {
        const isActive = level.id === activeLevelId;
        return (
          <button
            key={level.id}
            type="button"
            className={
              isActive
                ? `${styles.option} ${styles.optionActive}`
                : styles.option
            }
            aria-pressed={isActive}
            onClick={() => selectLevel(level.values)}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
