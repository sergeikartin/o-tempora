import { useMultiSelectFilter } from '../../../shared/lib/useMultiSelectFilter';
import type { Region } from '../../../shared/types';

// Session-only Region filter state (no persistence — resets on reload).
// One shared selection set applied across all three lanes, not per-lane.
export function useRegionFilter() {
  const { selected, toggle } = useMultiSelectFilter<Region>();
  return { selectedRegions: selected, toggleRegion: toggle };
}
