import { useEffect, useRef } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import type { HistoricalEvent, Person } from '../../shared/types';
import {
  PEOPLE_GROUPS,
  WARS_GROUPS,
  EVENTS_GROUPS,
  buildPeopleTimelineOptions,
  buildWarsTimelineOptions,
  buildEventsTimelineOptions,
} from './options';
import { mapInventionsToItems, mapPeopleToItems, mapWarsAndConflictsToItems } from './map-to-items';
import styles from './TimelineCanvas.module.css';

const ZOOM_STEP = 0.2;

interface TimelineCanvasProps {
  people: Person[];
  events: HistoricalEvent[];
}

export function TimelineCanvas({ people, events }: TimelineCanvasProps) {
  const peopleContainerRef = useRef<HTMLDivElement>(null);
  const warsContainerRef = useRef<HTMLDivElement>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const peopleTimelineRef = useRef<Timeline | null>(null);
  const warsTimelineRef = useRef<Timeline | null>(null);
  const eventsTimelineRef = useRef<Timeline | null>(null);

  useEffect(() => {
    if (!peopleContainerRef.current || !warsContainerRef.current || !eventsContainerRef.current) return;

    const peopleTimeline = new Timeline(peopleContainerRef.current, [], PEOPLE_GROUPS, buildPeopleTimelineOptions());
    const warsTimeline = new Timeline(warsContainerRef.current, [], WARS_GROUPS, buildWarsTimelineOptions());
    const eventsTimeline = new Timeline(
      eventsContainerRef.current,
      [],
      EVENTS_GROUPS,
      buildEventsTimelineOptions(),
    );
    peopleTimelineRef.current = peopleTimeline;
    warsTimelineRef.current = warsTimeline;
    eventsTimelineRef.current = eventsTimeline;

    // The three lanes are separate Timeline instances (see options.ts for
    // why) kept on the same visible time window — dragging or zooming any
    // one lane must move the other two together. One shared guard across
    // all three: calling setWindow on a target re-fires that target's own
    // 'rangechange', which would otherwise bounce back to the source (or
    // cross-bounce between the other two lanes) forever.
    let isSyncing = false;
    function syncWindow(targets: Timeline[]) {
      return ({ start, end }: { start: Date; end: Date }) => {
        if (isSyncing) return;
        isSyncing = true;
        try {
          for (const target of targets) {
            target.setWindow(start, end, { animation: false });
          }
        } finally {
          isSyncing = false;
        }
      };
    }
    peopleTimeline.on('rangechange', syncWindow([warsTimeline, eventsTimeline]));
    warsTimeline.on('rangechange', syncWindow([peopleTimeline, eventsTimeline]));
    eventsTimeline.on('rangechange', syncWindow([peopleTimeline, warsTimeline]));

    return () => {
      peopleTimeline.destroy();
      warsTimeline.destroy();
      eventsTimeline.destroy();
      peopleTimelineRef.current = null;
      warsTimelineRef.current = null;
      eventsTimelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    peopleTimelineRef.current?.setItems(mapPeopleToItems(people));
  }, [people]);

  useEffect(() => {
    warsTimelineRef.current?.setItems(mapWarsAndConflictsToItems(events));
  }, [events]);

  useEffect(() => {
    eventsTimelineRef.current?.setItems(mapInventionsToItems(events));
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
      <div ref={warsContainerRef} className={styles.warsLane} />
      <div ref={eventsContainerRef} className={styles.eventsLane} />
    </div>
  );
}
