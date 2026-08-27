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
  // app/use-detail-level-datasets.ts. A spinner only ever renders on the
  // active option, since a not-yet-selected level's data simply hasn't
  // started fetching (level 4) or is prefetching invisibly (level 3).
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
  const selectedLevel =
    DETAIL_LEVELS.find((level) => level.id === selectedLevelId) ??
    DETAIL_LEVELS[1];

  return (
    <div>
      <fieldset className={styles.switch} aria-label={m.detailLevelAriaLabel()}>
        {DETAIL_LEVELS.map((level) => {
          const isActive = level.id === selectedLevelId;
          const showSpinner = isActive && loadingLevelIds.includes(level.id);
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
              aria-busy={showSpinner}
              onClick={() => onSelectLevel(level)}
            >
              {level.label}
              {showSpinner && (
                <span
                  className={styles.spinner}
                  role="status"
                  aria-label={m.detailLevelLoadingAriaLabel()}
                />
              )}
            </button>
          );
        })}
      </fieldset>
      <p className={styles.description}>{selectedLevel.description}</p>
    </div>
  );
}
