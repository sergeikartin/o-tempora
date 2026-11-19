import { useMultiSelectFilter } from '../../../shared/lib/useMultiSelectFilter';
import type { Region } from '../../../shared/types';

export function useRegionFilter() {
  const { selected, toggle } = useMultiSelectFilter<Region>('region');
  return { selectedRegions: selected, toggleRegion: toggle };
}
