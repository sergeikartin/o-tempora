import type { ConflictsMilestonesFilterValue } from '../../../shared/config';
import { useMultiSelectFilter } from '../../../shared/lib/useMultiSelectFilter';

export function useConflictsMilestonesFilter() {
  const { selected, toggle } =
    useMultiSelectFilter<ConflictsMilestonesFilterValue>(
      'conflicts_milestones',
    );
  return { selectedValues: selected, toggleValue: toggle };
}
