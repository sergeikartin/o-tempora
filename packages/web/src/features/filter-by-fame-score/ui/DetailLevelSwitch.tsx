import type { CSSProperties } from 'react';
import {
  DETAIL_LEVELS,
  type DetailLevel,
  type DetailLevelId,
} from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import styles from './DetailLevelSwitch.module.css';

interface DetailLevelSwitchProps {
  selectedLevelId: DetailLevelId;
  onSelectLevel: (level: DetailLevel) => void;
  // Detail Level ids whose delta file hasn't resolved yet — see
  // app/use-detail-level-datasets.ts. The loading pulse only ever renders
  // on the active option, since a not-yet-selected level's data simply
  // hasn't started fetching (level 4) or is prefetching invisibly (level 3).
  loadingLevelIds: DetailLevelId[];
}

// 4-position preset that writes canonical values into the three fame-score
// floors driving the timeline's filter, and triggers whatever network fetch
// the selected level still needs (docs/adr/0006-detail-level-merges-data-
// depth-and-payload-tier.md). The active option is the caller's own explicit
// selection (`selectedLevelId`), not derived from the current fame-score
// values — there's no remaining production path where those two could
// disagree, since the manual numeric inputs that used to allow it are
// retired.
export function DetailLevelSwitch({
  selectedLevelId,
  onSelectLevel,
  loadingLevelIds,
}: DetailLevelSwitchProps) {
  const selectedIndex = Math.max(
    0,
    DETAIL_LEVELS.findIndex((level) => level.id === selectedLevelId),
  );
  const selectedLevel = DETAIL_LEVELS[selectedIndex] ?? DETAIL_LEVELS[1];
  const progress = (selectedIndex / (DETAIL_LEVELS.length - 1)) * 100;
  const isDeepCutLoading =
    selectedIndex === DETAIL_LEVELS.length - 1 &&
    loadingLevelIds.includes(selectedLevelId);
  // Hold the fill one stop short while deep-cut's data is still loading, so
  // the last segment only turns accent-colored once it's actually ready.
  const trackFillProgress = isDeepCutLoading
    ? ((DETAIL_LEVELS.length - 2) / (DETAIL_LEVELS.length - 1)) * 100
    : progress;

  return (
    <div>
      <fieldset className={styles.switch} aria-label={m.detailLevelAriaLabel()}>
        <div className={styles.labels}>
          {DETAIL_LEVELS.map((level, index) => (
            <span
              key={level.id}
              className={
                index <= selectedIndex
                  ? `${styles.label} ${styles.labelReached}`
                  : styles.label
              }
            >
              {level.label}
            </span>
          ))}
        </div>
        <div className={styles.track}>
          <div
            className={styles.trackFill}
            data-testid="track-fill"
            style={{ '--progress': `${trackFillProgress}%` } as CSSProperties}
          />
          {DETAIL_LEVELS.map((level, index) => {
            const isSelected = level.id === selectedLevelId;
            const showSpinner =
              isSelected && loadingLevelIds.includes(level.id);
            return (
              <button
                key={level.id}
                type="button"
                aria-label={level.label}
                aria-pressed={isSelected}
                aria-busy={showSpinner}
                className={
                  isSelected
                    ? `${styles.dot} ${styles.dotSelected}`
                    : index < selectedIndex
                      ? `${styles.dot} ${styles.dotReached}`
                      : styles.dot
                }
                onClick={() => onSelectLevel(level)}
              >
                {showSpinner && (
                  <span
                    className={styles.srOnly}
                    role="status"
                    aria-label={m.detailLevelLoadingAriaLabel()}
                  />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className={styles.description}>{selectedLevel.description}</p>
    </div>
  );
}
