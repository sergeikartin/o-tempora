import { useMultiSelectFilter } from '../../../shared/lib/useMultiSelectFilter';
import type { OccupationDomain } from '../../../shared/types';

export function useOccupationDomainFilter() {
  const { selected, toggle } =
    useMultiSelectFilter<OccupationDomain>('occupation_domain');
  return { selectedDomains: selected, toggleDomain: toggle };
}
