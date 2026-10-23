import {
  CONFLICTS_MILESTONES_FILTER_COLORS,
  CONFLICTS_MILESTONES_FILTER_LABELS,
  CONFLICTS_MILESTONES_FILTER_VALUES,
  type ConflictsMilestonesFilterValue,
} from '../../../shared/config';
import { FilterPillList } from '../../../shared/ui';

interface ConflictsMilestonesFiltersProps {
  selectedValues: ConflictsMilestonesFilterValue[];
  onToggleValue: (value: ConflictsMilestonesFilterValue) => void;
}

// The sidebar's "Conflicts & Milestones" section: one multi-select pill list
// shaped like OccupationDomainFilters/RegionFilters (swatched pills, empty
// selection means unfiltered), holding the 'conflicts' value alongside the
// MilestoneCategoryGroup values (CONTEXT.md's Milestone Category Group).
export function ConflictsMilestonesFilters({
  selectedValues,
  onToggleValue,
}: ConflictsMilestonesFiltersProps) {
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
