import { useEffect, useState } from 'react';
import {
  DEFAULT_DETAIL_LEVEL,
  type DetailLevel,
  FAME_SCORE_BOUNDS,
  type FameScoreLane,
} from '../../../shared/config';
import { trackEvent } from '../../../shared/lib/track-event';
import { registerDevFameScoreOverride } from './dev-fame-score-override';

export type { FameScoreLane };

export interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

// Post-filter entry counts per lane (all active filters applied), computed
// by widgets/timeline-canvas and threaded up through app/ to the sidebar.
export interface FilteredCounts {
  people: number;
  conflicts: number;
  milestones: number;
}

const DEFAULT_VALUES: FameScoreValues = {
  people: FAME_SCORE_BOUNDS.people.default,
  conflicts: FAME_SCORE_BOUNDS.conflicts.default,
  milestones: FAME_SCORE_BOUNDS.milestones.default,
};

// Session-only fame-score floor state (resets to Mainstream on reload).
// `level` is the Detail Level switch's own selection, tracked explicitly
// rather than derived from `values`: only the debug-only dev-console
// override can move `values` off a level's preset, and the switch needn't
// represent that. Shared by widgets/sidebar (the control) and
// widgets/timeline-canvas (the filtering).
export function useFameScoreFilters() {
  const [values, setValues] = useState<FameScoreValues>(DEFAULT_VALUES);
  const [level, setLevelState] = useState<DetailLevel>(DEFAULT_DETAIL_LEVEL);

  useEffect(() => {
    registerDevFameScoreOverride((partial) =>
      setValues((current) => ({ ...current, ...partial })),
    );
  }, []);

  function setLevel(nextLevel: DetailLevel) {
    setValues(nextLevel.values);
    setLevelState(nextLevel);
    trackEvent('data_depth_change', { level: nextLevel.id });
  }

  return { values, level, setLevel };
}
