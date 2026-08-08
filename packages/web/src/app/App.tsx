import { useMemo } from 'react';
import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import warsDataRaw from '@same-sky/shared-types/src/data/wars.json';
import discoveriesDataRaw from '@same-sky/shared-types/src/data/discoveries.json';
import type { Discovery, Person, WarsAndConflictsEntry } from '../shared/types';
import { useFameScoreFilters } from '../features/filter-by-fame-score';
import { useSelectedEntity } from '../features/select-timeline-entity';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import { Sidebar } from '../widgets/sidebar';
import { DetailPanel, type DetailPanelEntity } from '../widgets/detail-panel';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];
const warsData = warsDataRaw as WarsAndConflictsEntry[];
const discoveriesData = discoveriesDataRaw as Discovery[];

export function App() {
  const { values: fameScoreValues, setValue: setFameScoreValue } = useFameScoreFilters();
  const { selected: selectedRef, select: selectEntity, clear: closeDetailPanel } = useSelectedEntity();

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
    if (selectedRef.entityType === 'war') {
      const entry = warsData.find((candidate) => candidate.id === selectedRef.id);
      return entry ? { entityType: 'war', entity: entry } : null;
    }
    const discovery = discoveriesData.find((candidate) => candidate.id === selectedRef.id);
    return discovery ? { entityType: 'discovery', entity: discovery } : null;
  }, [selectedRef]);

  return (
    <>
      <h1 className={styles.srOnly}>World History Timeline</h1>
      <div className={styles.layout}>
        <Sidebar fameScoreValues={fameScoreValues} onFameScoreChange={setFameScoreValue} />
        <TimelineCanvas
          people={peopleData}
          wars={warsData}
          discoveries={discoveriesData}
          fameScoreValues={fameScoreValues}
          onEntityClick={selectEntity}
        />
        <DetailPanel selected={selectedEntity} onClose={closeDetailPanel} />
      </div>
    </>
  );
}
