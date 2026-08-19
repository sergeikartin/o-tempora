import { useMultiSelectFilter } from '../../../shared/lib/useMultiSelectFilter';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';

// Session-only Conflicts & Milestones filter state (no persistence — resets
// on reload). One flat multi-select toggle set spanning both the
// 'conflicts' sentinel and the MilestoneCategoryGroup values — empty means
// unfiltered, mirroring every other multi-select filter in the sidebar.
export function useConflictsMilestonesFilter() {
  const { selected, toggle } = useMultiSelectFilter<ConflictsMilestonesFilterValue>();
  return { selectedValues: selected, toggleValue: toggle };
}
