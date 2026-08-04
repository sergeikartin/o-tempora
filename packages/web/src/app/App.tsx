import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import warsDataRaw from '@same-sky/shared-types/src/data/wars.json';
import discoveriesDataRaw from '@same-sky/shared-types/src/data/discoveries.json';
import type { Discovery, Person, War } from '../shared/types';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];
const warsData = warsDataRaw as War[];
const discoveriesData = discoveriesDataRaw as Discovery[];

export function App() {
  return (
    <>
      <h1 className={styles.srOnly}>World History Timeline</h1>
      <TimelineCanvas people={peopleData} wars={warsData} discoveries={discoveriesData} />
    </>
  );
}
