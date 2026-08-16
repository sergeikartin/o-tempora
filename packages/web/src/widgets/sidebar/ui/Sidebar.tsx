import type { OccupationDomain, Region } from '../../../shared/types';
import { SWITCH_LANGUAGE_HREF, type ConflictsMilestonesFilterValue } from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import { useIsMobileViewport } from '../../../shared/lib/viewport';
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
  // Drawer open/close state (mobile-only visual effect — see
  // Sidebar.module.css's mobile breakpoint block; above that width this
  // prop has no effect since .sidebar isn't positioned/transformed at all).
  // The toggle button itself lives in TimelineCanvas, mirroring the
  // existing zoom-controls overlay's position — App.tsx owns the state both
  // widgets share.
  isOpen: boolean;
  onClose: () => void;
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
  isOpen,
  onClose,
}: SidebarProps) {
  const isMobileViewport = useIsMobileViewport();
  // Off-canvas (translateX, not display:none — Sidebar.module.css) is
  // invisible but not otherwise non-interactive: without this, a closed
  // mobile drawer's filter controls would still be keyboard-tabbable and
  // screen-reader-visible despite being off-screen. Only applies on mobile
  // — the desktop column (isOpen always false there, since the toggle
  // button that would flip it never renders) must stay interactive.
  const isInert = isMobileViewport && !isOpen;
  return (
    <>
      {isOpen && <button type="button" className={styles.backdrop} aria-label={m.closeAriaLabel()} onClick={onClose} />}
      <aside
        className={isOpen ? `${styles.sidebar} ${styles.open}` : styles.sidebar}
        aria-label={m.filtersAriaLabel()}
        inert={isInert}
      >
        {isMobileViewport && (
          <div className={styles.header}>
            <h2 className={styles.headerTitle}>{m.filtersHeading()}</h2>
            <button type="button" className={styles.closeButton} aria-label={m.closeFiltersAriaLabel()} onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <section className={styles.section}>
          <h2 className={styles.heading}>{m.dataDepthHeading()}</h2>
          <DataDepthSwitch values={fameScoreValues} onChange={onFameScoreChange} />
          <FameScoreFilters values={fameScoreValues} onChange={onFameScoreChange} counts={filteredCounts} />
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>{m.regionHeading()}</h2>
          <RegionFilters selectedRegions={selectedRegions} onToggleRegion={onToggleRegion} />
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>{m.peopleHeading()}</h2>
          <OccupationDomainFilters selectedDomains={selectedDomains} onToggleDomain={onToggleDomain} />
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>{m.conflictsMilestonesHeading()}</h2>
          <ConflictsMilestonesFilters
            selectedValues={selectedConflictsMilestonesValues}
            onToggleValue={onToggleConflictsMilestonesValue}
          />
        </section>
        <a className={styles.languageSwitcher} href={SWITCH_LANGUAGE_HREF}>
          {m.switchLanguageLabel()}
        </a>
      </aside>
    </>
  );
}
