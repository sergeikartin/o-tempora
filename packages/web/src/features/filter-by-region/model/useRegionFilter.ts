import { useState } from 'react';
import type { Region } from '../../../shared/types';

// Session-only Region filter state (no persistence — resets on reload, same
// convention as useFameScoreFilters/useOccupationDomainFilter). One shared
// selection set applied across all three lanes, not per-lane. Multi-select
// toggle: empty means unfiltered.
export function useRegionFilter() {
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);

  function toggleRegion(region: Region) {
    setSelectedRegions((current) =>
      current.includes(region) ? current.filter((selected) => selected !== region) : [...current, region],
    );
  }

  return { selectedRegions, toggleRegion };
}
