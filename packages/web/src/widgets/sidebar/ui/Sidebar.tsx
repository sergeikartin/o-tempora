import type { OccupationDomain, Region } from '../../../shared/types';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';
import {
  DataDepthSwitch,
  FameScoreFilters,
  type FameScoreLane,
  type FameScoreValues,
  type FilteredCounts,
} from '../../../features/filter-by-fame-score';
import { OccupationDomainFilters } from '../../../features/filter-by-occupation-domain';
import { RegionFilters } from '../../../features/filter-by-region';
import { ConflictsMilestonesFilters } from '../../../features/filter-conflicts-milestones';
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
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  onToggleConflictsMilestonesValue: (value: ConflictsMilestonesFilterValue) => void;
}

// Always-visible alongside TimelineCanvas — Data Depth (the fame-score
// floor controls that replaced the old zoom-coupled Fame Tier system, ADR
// 0003), a shared Region filter (one control narrowing all three lanes
// together), People (its Occupation Domain pills doubling as a
// click-to-toggle filter), and Conflicts & Milestones (one shared
// multi-select pill list — Conflicts plus the 3 Milestone Category Groups
// — mirroring Region/People's exact "one flat list, empty means
// unfiltered" shape; revised 2026-08-12 from an earlier two-control design,
// see docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md
// for why Conflicts has no per-category granularity of its own).
export function Sidebar({
  fameScoreValues,
  onFameScoreChange,
  filteredCounts,
  selectedDomains,
  onToggleDomain,
  selectedRegions,
  onToggleRegion,
  selectedConflictsMilestonesValues,
  onToggleConflictsMilestonesValue,
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
      <section className={styles.section}>
        <h2 className={styles.heading}>Conflicts & Milestones</h2>
        <ConflictsMilestonesFilters
          selectedValues={selectedConflictsMilestonesValues}
          onToggleValue={onToggleConflictsMilestonesValue}
        />
      </section>
    </aside>
  );
}
