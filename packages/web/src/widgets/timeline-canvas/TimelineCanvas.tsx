import { useEffect, useRef } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import type { HistoricalEvent, Person } from '../../shared/types';
import { PEOPLE_GROUPS, EVENTS_GROUPS, buildPeopleTimelineOptions, buildEventsTimelineOptions } from './options';
import { mapEventsToItems, mapPeopleToItems } from './map-to-items';
import styles from './TimelineCanvas.module.css';

const ZOOM_STEP = 0.2;

interface TimelineCanvasProps {
  people: Person[];
  events: HistoricalEvent[];
}

export function TimelineCanvas({ people, events }: TimelineCanvasProps) {
  const peopleContainerRef = useRef<HTMLDivElement>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const peopleTimelineRef = useRef<Timeline | null>(null);
  const eventsTimelineRef = useRef<Timeline | null>(null);

  useEffect(() => {
    if (!peopleContainerRef.current || !eventsContainerRef.current) return;

    const peopleTimeline = new Timeline(
      peopleContainerRef.current,
      [],
      PEOPLE_GROUPS,
      buildPeopleTimelineOptions(),
    );
    const eventsTimeline = new Timeline(
      eventsContainerRef.current,
      [],
      EVENTS_GROUPS,
      buildEventsTimelineOptions(),
    );
    peopleTimelineRef.current = peopleTimeline;
    eventsTimelineRef.current = eventsTimeline;

    // The two lanes are separate Timeline instances (see options.ts for why)
    // kept on the same visible time window — dragging or zooming either lane
    // must move both together. Guarded against feedback: calling setWindow
    // on the target re-fires its own 'rangechange', which would otherwise
    // bounce back to the source forever.
    let isSyncing = false;
    function syncWindow(target: Timeline) {
      return ({ start, end }: { start: Date; end: Date }) => {
        if (isSyncing) return;
        isSyncing = true;
        try {
          target.setWindow(start, end, { animation: false });
        } finally {
          isSyncing = false;
        }
      };
    }
    peopleTimeline.on('rangechange', syncWindow(eventsTimeline));
    eventsTimeline.on('rangechange', syncWindow(peopleTimeline));

    return () => {
      peopleTimeline.destroy();
      eventsTimeline.destroy();
      peopleTimelineRef.current = null;
      eventsTimelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    peopleTimelineRef.current?.setItems(mapPeopleToItems(people));
  }, [people]);

  useEffect(() => {
    eventsTimelineRef.current?.setItems(mapEventsToItems(events));
  }, [events]);

  function handleZoomIn() {
    eventsTimelineRef.current?.zoomIn(ZOOM_STEP);
  }

  function handleZoomOut() {
    eventsTimelineRef.current?.zoomOut(ZOOM_STEP);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.zoomControls}>
        <button type="button" onClick={handleZoomOut} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={handleZoomIn} aria-label="Zoom in">
          +
        </button>
      </div>
      <div ref={peopleContainerRef} className={styles.peopleLane} />
      <div ref={eventsContainerRef} className={styles.eventsLane} />
    </div>
  );
}
