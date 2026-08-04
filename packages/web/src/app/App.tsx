import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import type { Person } from '../shared/types';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];

export function App() {
  return (
    <>
      <h1 className={styles.srOnly}>World History Timeline</h1>
      <TimelineCanvas people={peopleData} />
    </>
  );
}
