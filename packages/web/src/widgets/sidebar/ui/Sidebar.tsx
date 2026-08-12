import type { OccupationDomain, Region } from '../../../shared/types';
import {
  DataDepthSwitch,
  FameScoreFilters,
  type FameScoreLane,
  type FameScoreValues,
  type FilteredCounts,
} from '../../../features/filter-by-fame-score';
import { OccupationDomainFilters } from '../../../features/filter-by-occupation-domain';
import { RegionFilters } from '../../../features/filter-by-region';
import styles from './Sidebar.module.css';

interface SidebarProps {
  fameScoreValues: FameScoreValues;
  onFameScoreChange: (lane: FameScoreLane, value: number) => void;
  // Post-filter entry count per lane, from TimelineCanvas via app/ — see
  // FameScoreFilters' own comment on why this is optional.
  filteredCounts?: FilteredCounts;
  selectedDomains: OccupationDomain[];
  onToggleDomain: (domain: OccupationDomain) => void;
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
}

// Always-visible alongside TimelineCanvas — Data Depth (the fame-score
// floor controls that replaced the old zoom-coupled Fame Tier system, ADR
// 0003), a shared Region filter (one control narrowing all three lanes
// together), and People (its Occupation Domain pills doubling as a
// click-to-toggle filter; Conflicts render in one flat color, not a
// palette-worthy one, and Milestones' MILESTONE_CATEGORY_COLORS are out of
// scope here).
export function Sidebar({
  fameScoreValues,
  onFameScoreChange,
  filteredCounts,
  selectedDomains,
  onToggleDomain,
  selectedRegions,
  onToggleRegion,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Filters">
      <section className={styles.section}>
        <h2 className={styles.heading}>Data Depth</h2>
        <DataDepthSwitch values={fameScoreValues} onChange={onFameScoreChange} />
        <FameScoreFilters values={fameScoreValues} onChange={onFameScoreChange} counts={filteredCounts} />
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Region</h2>
        <RegionFilters selectedRegions={selectedRegions} onToggleRegion={onToggleRegion} />
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>People</h2>
        <OccupationDomainFilters selectedDomains={selectedDomains} onToggleDomain={onToggleDomain} />
      </section>
    </aside>
  );
}
