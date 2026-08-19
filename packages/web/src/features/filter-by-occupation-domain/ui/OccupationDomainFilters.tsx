import { OCCUPATION_DOMAINS, type OccupationDomain } from '../../../shared/types';
import { DOMAIN_COLORS, DOMAIN_LABELS } from '../../../shared/config';
import { FilterPillList } from '../../../shared/ui';

interface OccupationDomainFiltersProps {
  selectedDomains: OccupationDomain[];
  onToggleDomain: (domain: OccupationDomain) => void;
}

// The sidebar's People section — Occupation Domain pills doubling as the
// filter (grill-with-docs session 2026-08-12): clicking a pill toggles that
// domain in/out of the active set. Multi-select OR; no domains active means
// unfiltered — see CONTEXT.md's Occupation Domain entry.
export function OccupationDomainFilters({ selectedDomains, onToggleDomain }: OccupationDomainFiltersProps) {
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
