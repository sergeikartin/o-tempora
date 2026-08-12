import { REGIONS, type Region } from '../../../shared/types';
import { REGION_LABELS } from '../../../shared/config';
import styles from './RegionFilters.module.css';

interface RegionFiltersProps {
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
}

// One shared Region filter control (not one per lane) narrowing People,
// Conflicts, and Milestones together (grill-with-docs session 2026-08-12).
// Multi-select OR; no regions active means unfiltered — see CONTEXT.md's
// Region entry.
export function RegionFilters({ selectedRegions, onToggleRegion }: RegionFiltersProps) {
  return (
    <ul className={styles.regions}>
      {REGIONS.map((region) => {
        const isActive = selectedRegions.includes(region);
        const label = REGION_LABELS[region];
        return (
          <li key={region}>
            <button
              type="button"
              className={isActive ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={isActive}
              aria-label={`Filter by ${label}`}
              onClick={() => onToggleRegion(region)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
