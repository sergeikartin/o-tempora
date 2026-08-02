import peopleDataRaw from '@same-sky/shared-types/src/data/people.json';
import eventsDataRaw from '@same-sky/shared-types/src/data/events.json';
import type { HistoricalEvent, Person } from '../shared/types';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';

const peopleData = peopleDataRaw as Person[];
const eventsData = eventsDataRaw as HistoricalEvent[];

export function App() {
  return (
    <>
      <h1 className={styles.srOnly}>World History Timeline</h1>
      <TimelineCanvas people={peopleData} events={eventsData} />
    </>
  );
}
