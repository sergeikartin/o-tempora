import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import warsDataRaw from '@same-sky/shared-types/src/data/wars.json';
import discoveriesDataRaw from '@same-sky/shared-types/src/data/discoveries.json';
import type { Discovery, Person, War } from '../shared/types';
import { useFameScoreFilters } from '../features/filter-by-fame-score';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import { Sidebar } from '../widgets/sidebar';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];
const warsData = warsDataRaw as War[];
const discoveriesData = discoveriesDataRaw as Discovery[];

export function App() {
  const { values: fameScoreValues, setValue: setFameScoreValue } = useFameScoreFilters();

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
        />
      </div>
    </>
  );
}
