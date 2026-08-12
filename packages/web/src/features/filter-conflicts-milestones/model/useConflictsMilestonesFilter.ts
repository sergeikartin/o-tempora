import { useState } from 'react';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';

// Session-only Conflicts & Milestones filter state (no persistence —
// resets on reload, same convention as useRegionFilter/
// useOccupationDomainFilter). One flat multi-select toggle set spanning
// both the 'conflicts' sentinel and the 3 MilestoneCategoryGroup values —
// empty means unfiltered, mirroring every other multi-select filter in the
// sidebar.
export function useConflictsMilestonesFilter() {
  const [selectedValues, setSelectedValues] = useState<ConflictsMilestonesFilterValue[]>([]);

  function toggleValue(value: ConflictsMilestonesFilterValue) {
    setSelectedValues((current) =>
      current.includes(value) ? current.filter((selected) => selected !== value) : [...current, value],
    );
  }

  return { selectedValues, toggleValue };
}
