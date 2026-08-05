import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Discovery, Person, War } from '../../shared/types';
import { DEFAULT_VIEWPORT_START } from '../../shared/config/viewport';
import { buildXScale, defaultPixelsPerYear, zoomIn as computeZoomIn, zoomOut as computeZoomOut } from './options';
import { PeopleLane } from './PeopleLane';
import { WarsLane } from './WarsLane';
import { EventsLane } from './EventsLane';
import styles from './TimelineCanvas.module.css';

interface TimelineCanvasProps {
  people: Person[];
  wars: War[];
  discoveries: Discovery[];
}

export function TimelineCanvas({ people, wars, discoveries }: TimelineCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pixelsPerYear, setPixelsPerYear] = useState(() => defaultPixelsPerYear(0));
  // Set by a zoom click to the year at the viewport's center just before the
  // change, so the effect below can re-center the scroll position on it once
  // the new xScale is in state — zooming in/out around what the user was
  // looking at rather than snapping back to the timeline's left edge.
  const pendingCenterYearRef = useRef<number | null>(null);

  const { scale, totalWidth } = useMemo(() => buildXScale(pixelsPerYear), [pixelsPerYear]);

  // Real browsers can measure the container before first paint; jsdom (and
  // any not-yet-laid-out first paint) can't, so the initial pixelsPerYear
  // state above already assumed a fallback width. Recompute from the real
  // width once available, and pan to the same default viewport vis-timeline
  // used to open on — computed against this effect's own local scale, not
  // the (still stale, pre-re-render) `scale` above.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nextPixelsPerYear = defaultPixelsPerYear(container.clientWidth);
    setPixelsPerYear(nextPixelsPerYear);
    const { scale: initialScale } = buildXScale(nextPixelsPerYear);
    container.scrollLeft = initialScale(DEFAULT_VIEWPORT_START.year);
  }, []);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const centerYear = pendingCenterYearRef.current;
    if (!container || centerYear === null) return;
    container.scrollLeft = scale(centerYear) - container.clientWidth / 2;
    pendingCenterYearRef.current = null;
  }, [pixelsPerYear, scale]);

  function zoom(step: (currentPixelsPerYear: number, viewportWidthPx: number) => number) {
    const container = scrollRef.current;
    if (!container) {
      setPixelsPerYear((current) => step(current, 0));
      return;
    }
    pendingCenterYearRef.current = scale.invert(container.scrollLeft + container.clientWidth / 2);
    setPixelsPerYear((current) => step(current, container.clientWidth));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.zoomControls}>
        <button type="button" onClick={() => zoom(computeZoomOut)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => zoom(computeZoomIn)} aria-label="Zoom in">
          +
        </button>
      </div>
      <div ref={scrollRef} className={styles.scrollContainer}>
        <div className={styles.peopleLane} style={{ width: totalWidth }}>
          <PeopleLane people={people} xScale={scale} />
        </div>
        <div className={styles.warsLane} style={{ width: totalWidth }}>
          <WarsLane wars={wars} xScale={scale} />
        </div>
        <div className={styles.eventsLane} style={{ width: totalWidth }}>
          <EventsLane discoveries={discoveries} xScale={scale} />
        </div>
      </div>
    </div>
  );
}
