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
