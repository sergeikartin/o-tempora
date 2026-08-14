import { useMemo, useState } from 'react';
import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import conflictsDataRaw from '@same-sky/shared-types/src/data/conflicts.json';
import milestonesDataRaw from '@same-sky/shared-types/src/data/milestones.json';
import type { Milestone, Person, ConflictEntry } from '../shared/types';
import { STRINGS } from '../shared/i18n';
import { useFameScoreFilters, type FilteredCounts } from '../features/filter-by-fame-score';
import { useOccupationDomainFilter } from '../features/filter-by-occupation-domain';
import { useRegionFilter } from '../features/filter-by-region';
import { useConflictsMilestonesFilter } from '../features/filter-conflicts-milestones';
import { useSelectedEntity } from '../features/select-timeline-entity';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import { Sidebar } from '../widgets/sidebar';
import { DetailPanel, type DetailPanelEntity } from '../widgets/detail-panel';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];
const conflictsData = conflictsDataRaw as ConflictEntry[];
const milestonesData = milestonesDataRaw as Milestone[];

export function App() {
  const { values: fameScoreValues, setValue: setFameScoreValue } = useFameScoreFilters();
  const { selectedDomains, toggleDomain } = useOccupationDomainFilter();
  const { selectedRegions, toggleRegion } = useRegionFilter();
  const { selectedValues: selectedConflictsMilestonesValues, toggleValue: toggleConflictsMilestonesValue } =
    useConflictsMilestonesFilter();
  const { selected: selectedRef, select: selectEntity, clear: closeDetailPanel } = useSelectedEntity();
  const [filteredCounts, setFilteredCounts] = useState<FilteredCounts>();

  // Looks the clicked id up in the already-in-memory datasets (dynamic-
  // tooltips spec §2's "on-demand rendering" — nothing about drawer content
  // is precomputed for the full filtered dataset) rather than threading a
  // full entity object through the click event itself.
  const selectedEntity: DetailPanelEntity | null = useMemo(() => {
    if (!selectedRef) return null;
    if (selectedRef.entityType === 'person') {
      const person = peopleData.find((candidate) => candidate.id === selectedRef.id);
      return person ? { entityType: 'person', entity: person } : null;
    }
    if (selectedRef.entityType === 'conflict') {
      const entry = conflictsData.find((candidate) => candidate.id === selectedRef.id);
      return entry ? { entityType: 'conflict', entity: entry } : null;
    }
    const milestone = milestonesData.find((candidate) => candidate.id === selectedRef.id);
    return milestone ? { entityType: 'milestone', entity: milestone } : null;
  }, [selectedRef]);

  return (
    <>
      <h1 className={styles.srOnly}>{STRINGS.siteTitle}</h1>
      <div className={styles.layout}>
        <Sidebar
          fameScoreValues={fameScoreValues}
          onFameScoreChange={setFameScoreValue}
          filteredCounts={filteredCounts}
          selectedDomains={selectedDomains}
          onToggleDomain={toggleDomain}
          selectedRegions={selectedRegions}
          onToggleRegion={toggleRegion}
          selectedConflictsMilestonesValues={selectedConflictsMilestonesValues}
          onToggleConflictsMilestonesValue={toggleConflictsMilestonesValue}
        />
        <TimelineCanvas
          people={peopleData}
          conflicts={conflictsData}
          milestones={milestonesData}
          fameScoreValues={fameScoreValues}
          selectedDomains={selectedDomains}
          selectedRegions={selectedRegions}
          selectedConflictsMilestonesValues={selectedConflictsMilestonesValues}
          onEntityClick={selectEntity}
          onFilteredCountsChange={setFilteredCounts}
        />
        <DetailPanel selected={selectedEntity} onClose={closeDetailPanel} />
      </div>
    </>
  );
}
