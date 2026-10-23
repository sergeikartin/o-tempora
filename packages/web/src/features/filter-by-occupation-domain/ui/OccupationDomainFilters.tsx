import { DOMAIN_COLORS, DOMAIN_LABELS } from '../../../shared/config';
import {
  OCCUPATION_DOMAINS,
  type OccupationDomain,
} from '../../../shared/types';
import { FilterPillList } from '../../../shared/ui';

interface OccupationDomainFiltersProps {
  selectedDomains: OccupationDomain[];
  onToggleDomain: (domain: OccupationDomain) => void;
}

// The sidebar's People section: Occupation Domain pills that toggle the
// domain in/out of the active set. Multi-select OR; none active means
// unfiltered (CONTEXT.md's Occupation Domain).
export function OccupationDomainFilters({
  selectedDomains,
  onToggleDomain,
}: OccupationDomainFiltersProps) {
  return (
    <FilterPillList
      values={OCCUPATION_DOMAINS}
      selected={selectedDomains}
      onToggle={onToggleDomain}
      labelOf={(domain) => DOMAIN_LABELS[domain]}
      colorOf={(domain) => DOMAIN_COLORS[domain]}
    />
  );
}
