import {
  CONFLICTS_MILESTONES_FILTER_VALUES,
  CONFLICTS_MILESTONES_FILTER_COLORS,
  CONFLICTS_MILESTONES_FILTER_LABELS,
  type ConflictsMilestonesFilterValue,
} from '../../../shared/config';
import { FilterPillList } from '../../../shared/ui';

interface ConflictsMilestonesFiltersProps {
  selectedValues: ConflictsMilestonesFilterValue[];
  onToggleValue: (value: ConflictsMilestonesFilterValue) => void;
}

// The sidebar's "Conflicts & Milestones" section — one shared multi-select
// pill list (revised 2026-08-12 to mirror OccupationDomainFilters/
// RegionFilters' exact shape: one flat list of values, each pill swatched
// and independently toggleable, empty selection means unfiltered). Folds
// the 'conflicts' sentinel (Conflicts carry no color-driving grouping of
// their own — see CONTEXT.md's Conflict Category entry) together with the
// MilestoneCategoryGroup values into one list, since from the user's
// perspective it's one filter over one sidebar section, not two
// differently-behaved controls.
export function ConflictsMilestonesFilters({ selectedValues, onToggleValue }: ConflictsMilestonesFiltersProps) {
  return (
    <FilterPillList
      values={CONFLICTS_MILESTONES_FILTER_VALUES}
      selected={selectedValues}
      onToggle={onToggleValue}
      labelOf={(value) => CONFLICTS_MILESTONES_FILTER_LABELS[value]}
      colorOf={(value) => CONFLICTS_MILESTONES_FILTER_COLORS[value]}
    />
  );
}
