import { useState } from 'react';
import { FAME_SCORE_BOUNDS, type FameScoreLane } from '../../../shared/config';

export type { FameScoreLane };

export interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

const DEFAULT_VALUES: FameScoreValues = {
  people: FAME_SCORE_BOUNDS.people.default,
  conflicts: FAME_SCORE_BOUNDS.conflicts.default,
  milestones: FAME_SCORE_BOUNDS.milestones.default,
};

// Session-only fame-score floor state (no persistence — resets to the
// CORE-tier-matching defaults above on reload), owned here since it's
// shared by widgets/sidebar (the controls) and widgets/timeline-canvas
// (the filtering itself).
export function useFameScoreFilters() {
  const [values, setValues] = useState<FameScoreValues>(DEFAULT_VALUES);

  function setValue(lane: FameScoreLane, value: number) {
    setValues((current) => ({ ...current, [lane]: value }));
  }

  return { values, setValue };
}
