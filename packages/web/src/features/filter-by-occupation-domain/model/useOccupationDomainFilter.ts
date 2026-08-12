import { useState } from 'react';
import type { OccupationDomain } from '../../../shared/types';

// Session-only Occupation Domain filter state (no persistence — resets on
// reload, same convention as useFameScoreFilters). Multi-select toggle set:
// empty means unfiltered.
export function useOccupationDomainFilter() {
  const [selectedDomains, setSelectedDomains] = useState<OccupationDomain[]>([]);

  function toggleDomain(domain: OccupationDomain) {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((selected) => selected !== domain) : [...current, domain],
    );
  }

  return { selectedDomains, toggleDomain };
}
