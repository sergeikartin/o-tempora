import { useRef } from 'react';
import { OccupationDomainFilters } from '../../../features/filter-by-occupation-domain';
import { RegionFilters } from '../../../features/filter-by-region';
import { ConflictsMilestonesFilters } from '../../../features/filter-conflicts-milestones';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';
import { useModalFocus } from '../../../shared/lib/useModalFocus';
import { m } from '../../../shared/paraglide/messages.js';
import type { OccupationDomain, Region } from '../../../shared/types';
import styles from './FiltersPanel.module.css';

interface FiltersPanelProps {
  onClose: () => void;
  selectedDomains: OccupationDomain[];
  onToggleDomain: (domain: OccupationDomain) => void;
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  onToggleConflictsMilestonesValue: (
    value: ConflictsMilestonesFilterValue,
  ) => void;
}

// Occupation Domain, Region and Conflicts & Milestones (CONTEXT.md's Filters
// Panel). Mounted only while open: a popover under the Filters button on
// desktop, a bottom sheet at the mobile breakpoint (FiltersPanel.module.css).
// Modal either way, so focus stays inside until it closes.
export function FiltersPanel({
  onClose,
  selectedDomains,
  onToggleDomain,
  selectedRegions,
  onToggleRegion,
  selectedConflictsMilestonesValues,
  onToggleConflictsMilestonesValue,
}: FiltersPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalFocus({
    isOpen: true,
    panelRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label={m.closeAriaLabel()}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={m.filtersLabel()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{m.filtersLabel()}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label={m.closeFiltersAriaLabel()}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.heading}>{m.occupationHeading()}</h3>
            <OccupationDomainFilters
              selectedDomains={selectedDomains}
              onToggleDomain={onToggleDomain}
            />
          </section>
          <section className={styles.section}>
            <h3 className={styles.heading}>{m.conflictsMilestonesHeading()}</h3>
            <ConflictsMilestonesFilters
              selectedValues={selectedConflictsMilestonesValues}
              onToggleValue={onToggleConflictsMilestonesValue}
            />
          </section>
          <section className={styles.section}>
            <h3 className={styles.heading}>{m.regionHeading()}</h3>
            <RegionFilters
              selectedRegions={selectedRegions}
              onToggleRegion={onToggleRegion}
            />
          </section>
        </div>
      </div>
    </>
  );
}
