import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Discovery, Person, WarsAndConflictsEntry } from '../../shared/types';
import { DEFAULT_VIEWPORT_START } from '../../shared/config';
import type { FameScoreValues } from '../../features/filter-by-fame-score';
import {
  buildXScale,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  defaultPixelsPerYear,
  FALLBACK_VIEWPORT_WIDTH_PX,
  VIEWPORT_BUFFER_RATIO,
  zoomIn as computeZoomIn,
  zoomOut as computeZoomOut,
} from './options';
import { filterByFameScore } from './map-to-items';
import { PeopleLane } from './PeopleLane';
import { WarsLane } from './WarsLane';
import { EventsLane } from './EventsLane';
import { YearAxis } from './YearAxis';
import styles from './TimelineCanvas.module.css';

interface TimelineCanvasProps {
  people: Person[];
  wars: WarsAndConflictsEntry[];
  discoveries: Discovery[];
  // Sidebar-set fame-score floors (ADR 0003) — zoom no longer drives entity
  // density, so this is a plain prop, not derived from pixelsPerYear.
  fameScoreValues: FameScoreValues;
}

export function TimelineCanvas({ people, wars, discoveries, fameScoreValues }: TimelineCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Drag-to-pan state: mouse-only (touch already gets native scroll-by-swipe
  // on the overflow-x container for free, and layering pointer-drag on top
  // of that would double-handle touch input). Start position lives in a ref
  // since it's read/written every pointermove but never needs to trigger a
  // render; isDragging is state purely to toggle the grab/grabbing cursor.
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; scrollLeft: number } | null>(null);
  const [pixelsPerYear, setPixelsPerYear] = useState(() => defaultPixelsPerYear(0));
  // Set by a zoom click to the year at the viewport's center just before the
  // change, so the effect below can re-center the scroll position on it once
  // the new xScale is in state — zooming in/out around what the user was
  // looking at rather than snapping back to the timeline's left edge.
  const pendingCenterYearRef = useRef<number | null>(null);

  const { scale, totalWidth } = useMemo(() => buildXScale(pixelsPerYear), [pixelsPerYear]);

  // Tracked in state (set alongside pixelsPerYear on mount-measurement and
  // on each zoom click, both of which already read the container's real
  // clientWidth) rather than read from scrollRef during render, which React
  // disallows.
  const [viewportWidthPx, setViewportWidthPx] = useState(0);

  // Drives the Year Axis's viewport-windowed tick rendering (see YearAxis.tsx)
  // — tracked separately from viewportWidthPx above since this one needs to
  // follow live scroll position, not just mount/zoom-time measurements.
  const [scrollLeft, setScrollLeft] = useState(0);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollLeft(container.scrollLeft);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const effectiveViewportWidthPx = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const viewportBufferPx = effectiveViewportWidthPx * VIEWPORT_BUFFER_RATIO;
  const visibleStartYear = scale.invert(scrollLeft - viewportBufferPx);
  const visibleEndYear = scale.invert(scrollLeft + effectiveViewportWidthPx + viewportBufferPx);

  // Faint full-height decade gridlines (see .scrollContainer's background in
  // TimelineCanvas.module.css) — pure CSS like the Year Axis's own ticks, so
  // this scales to any width for free rather than needing per-line DOM nodes.
  const decadeGridlineStyle = {
    '--decade-gridline-px': `${pixelsPerYear * DECADE_STEP_YEARS}px`,
    '--decade-gridline-offset-px': `${pixelsPerYear * DECADE_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const filteredPeople = useMemo(
    () => filterByFameScore(people, fameScoreValues.people),
    [people, fameScoreValues.people],
  );
  const filteredWars = useMemo(
    () => filterByFameScore(wars, fameScoreValues.wars),
    [wars, fameScoreValues.wars],
  );
  const filteredDiscoveries = useMemo(
    () => filterByFameScore(discoveries, fameScoreValues.discoveries),
    [discoveries, fameScoreValues.discoveries],
  );

  // Real browsers can measure the container before first paint; jsdom (and
  // any not-yet-laid-out first paint) can't, so the initial pixelsPerYear
  // state above already assumed a fallback width. Recompute from the real
  // width once available; the pan-to-default-viewport below waits for that
  // recomputed pixelsPerYear to actually land (see the ref's comment).
  const measuredPixelsPerYearRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    measuredPixelsPerYearRef.current = defaultPixelsPerYear(container.clientWidth);
    setPixelsPerYear(measuredPixelsPerYearRef.current);
    setViewportWidthPx(container.clientWidth);
  }, []);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (pendingCenterYearRef.current !== null) {
      container.scrollLeft = scale(pendingCenterYearRef.current) - container.clientWidth / 2;
      pendingCenterYearRef.current = null;
      setScrollLeft(container.scrollLeft);
      return;
    }
    // The mount effect above sets pixelsPerYear state but can't set
    // scrollLeft itself — the lanes' widths (and so this container's
    // scrollWidth) haven't re-rendered to match yet, so an immediate
    // scrollLeft assignment gets silently clamped to the still-stale
    // scrollWidth and never corrected. Wait for pixelsPerYear to actually
    // equal what that effect measured — i.e. for this render's scale to be
    // the real one, not the pre-layout fallback — before panning.
    if (pixelsPerYear === measuredPixelsPerYearRef.current) {
      container.scrollLeft = scale(DEFAULT_VIEWPORT_START.year);
      setScrollLeft(container.scrollLeft);
    }
  }, [pixelsPerYear, scale]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    dragStartRef.current = { pointerX: event.clientX, scrollLeft: container.scrollLeft };
    // Best-effort: keeps the drag alive if the pointer leaves the container's
    // bounds mid-move. jsdom doesn't implement it at all (hence the optional
    // chaining), and even real browsers can throw NotFoundError for a
    // pointerId they no longer consider active — either way the drag itself
    // (driven by dragStartRef, not capture) must still work, so failures here
    // are swallowed rather than left to abort the rest of this handler.
    try {
      container.setPointerCapture?.(event.pointerId);
    } catch {
      // no-op — see comment above
    }
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStartRef.current;
    const container = scrollRef.current;
    if (!drag || !container) return;
    container.scrollLeft = drag.scrollLeft - (event.clientX - drag.pointerX);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    try {
      scrollRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment
    }
    setIsDragging(false);
  }

  function zoom(step: (currentPixelsPerYear: number, viewportWidthPx: number) => number) {
    const container = scrollRef.current;
    if (!container) {
      setPixelsPerYear((current) => step(current, 0));
      return;
    }
    pendingCenterYearRef.current = scale.invert(container.scrollLeft + container.clientWidth / 2);
    setViewportWidthPx(container.clientWidth);
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
      <div
        ref={scrollRef}
        className={isDragging ? `${styles.scrollContainer} ${styles.dragging}` : styles.scrollContainer}
        style={decadeGridlineStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.peopleLane} style={{ width: totalWidth }}>
          <PeopleLane people={filteredPeople} xScale={scale} />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis xScale={scale} visibleStartYear={visibleStartYear} visibleEndYear={visibleEndYear} />
        </div>
        <div className={styles.warsLane} style={{ width: totalWidth }}>
          <WarsLane wars={filteredWars} xScale={scale} />
        </div>
        <div className={styles.eventsLane} style={{ width: totalWidth }}>
          <EventsLane discoveries={filteredDiscoveries} xScale={scale} />
        </div>
      </div>
    </div>
  );
}
