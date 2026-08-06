import { OCCUPATION_DOMAINS } from '../../../shared/types';
import { DOMAIN_COLORS, DOMAIN_LABELS } from '../../../shared/config';
import { FameScoreFilters, type FameScoreLane, type FameScoreValues } from '../../../features/filter-by-fame-score';
import styles from './Sidebar.module.css';

interface SidebarProps {
  fameScoreValues: FameScoreValues;
  onFameScoreChange: (lane: FameScoreLane, value: number) => void;
}

// Always-visible alongside TimelineCanvas — a Legend (visual-only pills for
// People's 8 OccupationDomain colors; Wars/Discoveries' CATEGORY_COLORS are
// out of scope here) and Filters (the fame-score floor controls that
// replaced the old zoom-coupled Fame Tier system, ADR 0003).
export function Sidebar({ fameScoreValues, onFameScoreChange }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Legend and filters">
      <section className={styles.section}>
        <h2 className={styles.heading}>Legend</h2>
        <ul className={styles.legend}>
          {OCCUPATION_DOMAINS.map((domain) => (
            <li key={domain} className={styles.pill}>
              <span className={styles.swatch} style={{ backgroundColor: DOMAIN_COLORS[domain] }} aria-hidden="true" />
              {DOMAIN_LABELS[domain]}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Filters</h2>
        <FameScoreFilters values={fameScoreValues} onChange={onFameScoreChange} />
      </section>
    </aside>
  );
}
