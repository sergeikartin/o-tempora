import {
  DATA_DEPTH_LEVELS,
  type DataDepthLevel,
  matchDataDepthLevel,
} from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import type { FameScoreValues } from '../model/useFameScoreFilters';
import styles from './DataDepthSwitch.module.css';

interface DataDepthSwitchProps {
  values: FameScoreValues;
  onSelectLevel: (level: DataDepthLevel) => void;
}

// Two-position preset that writes canonical values into the three
// numeric fame-score inputs below it (grill-with-docs session 2026-08-18).
// No separate "active level" state — the highlighted option is derived
// straight from `values` each render, so a hand-edited numeric input
// automatically drops the switch to no option shown as active ("custom").
export function DataDepthSwitch({
  values,
  onSelectLevel,
}: DataDepthSwitchProps) {
  const activeLevelId = matchDataDepthLevel(values);

  return (
    <fieldset className={styles.switch} aria-label={m.dataDepthAriaLabel()}>
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
            onClick={() => onSelectLevel(level)}
          >
            {level.label}
          </button>
        );
      })}
    </fieldset>
  );
}
