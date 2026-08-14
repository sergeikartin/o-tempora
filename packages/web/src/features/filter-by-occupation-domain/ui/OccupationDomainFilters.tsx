import { OCCUPATION_DOMAINS, type OccupationDomain } from '../../../shared/types';
import { DOMAIN_COLORS, DOMAIN_LABELS } from '../../../shared/config';
import { STRINGS } from '../../../shared/i18n';
import styles from './OccupationDomainFilters.module.css';

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
    <ul className={styles.legend}>
      {OCCUPATION_DOMAINS.map((domain) => {
        const isActive = selectedDomains.includes(domain);
        const label = DOMAIN_LABELS[domain];
        return (
          <li key={domain}>
            <button
              type="button"
              className={isActive ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={isActive}
              aria-label={STRINGS.filterByLabel(label)}
              onClick={() => onToggleDomain(domain)}
            >
              <span className={styles.swatch} style={{ backgroundColor: DOMAIN_COLORS[domain] }} aria-hidden="true" />
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
