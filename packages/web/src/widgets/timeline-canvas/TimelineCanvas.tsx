import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Milestone, Person, ConflictEntry } from '../../shared/types';
import { DEFAULT_VIEWPORT_START } from '../../shared/config';
import type { FameScoreValues } from '../../features/filter-by-fame-score';
import { ENTITY_TYPES, type SelectedEntityRef } from '../../features/select-timeline-entity';
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
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import { YearAxis } from './YearAxis';
import styles from './TimelineCanvas.module.css';

// Below this much total pointer movement, a mouse-drag is treated as a click
// (e.g. a hand that isn't perfectly still on mousedown) rather than a pan —
// see suppressNextClickRef below.
const DRAG_CLICK_SUPPRESSION_PX = 4;

// Enforced via CSS min-width on .scrollbarThumb (see its module.css comment)
// — kept here too since the drag math below needs the same floor to convert
// a thumb pointer-move into a scrollLeft delta.
const MIN_SCROLLBAR_THUMB_PX = 24;

interface TimelineCanvasProps {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // Sidebar-set fame-score floors (ADR 0003) — zoom no longer drives entity
  // density, so this is a plain prop, not derived from pixelsPerYear.
  fameScoreValues: FameScoreValues;
  // Reports a click on any lane's mark, resolved via one delegated listener
  // below rather than three separate per-lane click handlers (dynamic-
  // tooltips spec §2's click-wiring architecture) — the caller (App.tsx)
  // owns looking the id up in the full in-memory dataset and opening the
  // detail drawer.
  onEntityClick: (ref: SelectedEntityRef) => void;
}

export function TimelineCanvas({ people, conflicts, milestones, fameScoreValues, onEntityClick }: TimelineCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // People and Conflicts+Milestones are `position: sticky; left: 0` (see their CSS) so
  // each one's own vertical scrollbar stays docked to the viewport's right
  // edge no matter where scrollRef is panned to horizontally — a sticky
  // element never moves, so it doesn't scroll its own totalWidth-wide
  // content along with it. These refs let the scroll handler below drive
  // that inner pan itself, by mirroring scrollRef's scrollLeft onto each one
  // (scrollLeft still works on an overflow-x: hidden element; it just isn't
  // user-drivable, which is exactly what's wanted since scrollRef alone
  // should own the horizontal gesture).
  const peopleLaneRef = useRef<HTMLDivElement>(null);
  const conflictsMilestonesLaneRef = useRef<HTMLDivElement>(null);
  // Drag-to-pan state: mouse-only (touch already gets native scroll-by-swipe
  // on the overflow-x container for free, and layering pointer-drag on top
  // of that would double-handle touch input). Start position lives in a ref
  // since it's read/written every pointermove but never needs to trigger a
  // render; isDragging is state purely to toggle the grab/grabbing cursor.
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; scrollLeft: number; moved: boolean } | null>(null);
  // Set by endDrag when a drag moved past DRAG_CLICK_SUPPRESSION_PX, read
  // and cleared by the delegated click listener below — a mouseup after a
  // real drag still fires a native click at the release point, which would
  // otherwise open whatever mark/label happens to be under the pointer when
  // the user was only trying to pan, not select something.
  const suppressNextClickRef = useRef(false);
  // Custom scrollbar: the native one isn't a real DOM node, so a mousedown
  // on its thumb/track still targets scrollRef and gets swallowed by the
  // drag-to-pan handlers above, with no reliable way to tell "this press
  // landed on the native scrollbar" apart from "this press landed on the
  // timeline content" — that distinction depends on whether the browser
  // happens to reserve layout space for its scrollbar at all, which isn't
  // consistent even across browsers on the same OS (e.g. Firefox's overlay
  // scrollbars reserve none). Rendering our own track/thumb as ordinary
  // sibling elements sidesteps the ambiguity entirely: a press on
  // scrollbarThumbRef never reaches scrollRef's pointer handlers, and vice
  // versa, so no detection heuristic is needed on either side.
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbDragRef = useRef<{ pointerX: number; startScrollLeft: number; trackWidthPx: number } | null>(null);
  const [isThumbDragging, setIsThumbDragging] = useState(false);
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
        if (peopleLaneRef.current) peopleLaneRef.current.scrollLeft = container.scrollLeft;
        if (conflictsMilestonesLaneRef.current) conflictsMilestonesLaneRef.current.scrollLeft = container.scrollLeft;
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

  // Custom scrollbar thumb geometry, expressed as ratios (0–1) rather than
  // pixels so it tracks the track element's real rendered width for free —
  // the track spans the same width as scrollRef itself (both are full-width
  // flex children of .wrapper), but reading that width directly during
  // render isn't available before layout, same reasoning as
  // effectiveViewportWidthPx above. MIN_SCROLLBAR_THUMB_PX is instead
  // enforced via CSS min-width on the thumb; ratio-based left/width already
  // keep left + width <= 1 in the common case, only under/overshooting by
  // that CSS floor's own clamp on a very short track relative to totalWidth.
  const thumbWidthRatio = totalWidth > 0 ? Math.min(effectiveViewportWidthPx / totalWidth, 1) : 1;
  const maxScrollLeftForThumb = Math.max(totalWidth - effectiveViewportWidthPx, 0);
  const thumbLeftRatio =
    maxScrollLeftForThumb > 0 ? (scrollLeft / maxScrollLeftForThumb) * (1 - thumbWidthRatio) : 0;

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
  const filteredConflicts = useMemo(
    () => filterByFameScore(conflicts, fameScoreValues.conflicts),
    [conflicts, fameScoreValues.conflicts],
  );
  const filteredMilestones = useMemo(
    () => filterByFameScore(milestones, fameScoreValues.milestones),
    [milestones, fameScoreValues.milestones],
  );

  // Fame-priority row packing (assignRows) puts the most important rows
  // next to the shared Year Axis — bottom of .peopleLane, top of
  // .conflictsMilestonesLane (grill-with-docs session, 2026-08-11). Each
  // lane's own overflow-y: auto already lets it scroll independently; these
  // two effects default that scroll position to the axis-adjacent edge
  // whenever the visible item set changes (mount, or a fame-score filter
  // moving the floor), so the most important rows are on screen without the
  // user having to scroll for them first. .conflictsMilestonesLane's
  // axis-adjacent edge is its natural top (scrollTop 0), so it only needs a
  // reset, not a measurement; .peopleLane's is its bottom, which needs
  // scrollHeight (only known post-layout, hence useLayoutEffect for both).
  useLayoutEffect(() => {
    const el = peopleLaneRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filteredPeople]);
  useLayoutEffect(() => {
    const el = conflictsMilestonesLaneRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [filteredConflicts, filteredMilestones]);

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
    dragStartRef.current = { pointerX: event.clientX, scrollLeft: container.scrollLeft, moved: false };
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
    const totalOffset = event.clientX - drag.pointerX;
    if (Math.abs(totalOffset) > DRAG_CLICK_SUPPRESSION_PX) drag.moved = true;
    container.scrollLeft = drag.scrollLeft - totalOffset;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStartRef.current;
    if (!drag) return;
    dragStartRef.current = null;
    // The mouseup a real drag ends with still fires a native click at the
    // release point (browsers don't suppress it just because the pointer
    // moved) — that click would otherwise open whatever mark/label happens
    // to be under the cursor, even though the user was only panning. The
    // delegated click listener below checks and clears this flag before
    // acting on anything.
    if (drag.moved) suppressNextClickRef.current = true;
    try {
      scrollRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment
    }
    setIsDragging(false);
  }

  function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    // Stops the pointerdown from ever reaching the track's own
    // onPointerDown below (React events bubble like native ones) — a press
    // that starts on the thumb should drag it, not also jump-to-position
    // via the track's click-to-jump handler.
    event.stopPropagation();
    const container = scrollRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    thumbDragRef.current = { pointerX: event.clientX, startScrollLeft: container.scrollLeft, trackWidthPx: track.clientWidth };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment on the same pattern
    }
    setIsThumbDragging(true);
  }

  function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = thumbDragRef.current;
    const container = scrollRef.current;
    if (!drag || !container) return;
    const maxScrollLeft = Math.max(totalWidth - drag.trackWidthPx, 0);
    if (maxScrollLeft <= 0) return;
    // Same MIN_SCROLLBAR_THUMB_PX floor as the thumb's own CSS min-width —
    // needed here so a dragged pixel maps to the same scrollLeft distance
    // the rendered (possibly floor-clamped) thumb width implies, otherwise
    // the thumb would visibly lag or overrun the pointer on a short track.
    const thumbWidthPx = Math.max(MIN_SCROLLBAR_THUMB_PX, (drag.trackWidthPx / totalWidth) * drag.trackWidthPx);
    const maxThumbOffsetPx = Math.max(drag.trackWidthPx - thumbWidthPx, 1);
    const deltaPx = event.clientX - drag.pointerX;
    const scrollLeftPerThumbPx = maxScrollLeft / maxThumbOffsetPx;
    container.scrollLeft = Math.min(Math.max(drag.startScrollLeft + deltaPx * scrollLeftPerThumbPx, 0), maxScrollLeft);
  }

  function endThumbDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!thumbDragRef.current) return;
    thumbDragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment on the same pattern
    }
    setIsThumbDragging(false);
  }

  // Clicking the track outside the thumb jumps the viewport to center on
  // that point, the same "page toward click" convenience a native
  // scrollbar's track region gives for free. A press that starts on the
  // thumb itself never reaches here — handleThumbPointerDown's
  // stopPropagation above stops it from bubbling up to this handler.
  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const container = scrollRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const maxScrollLeft = Math.max(totalWidth - track.clientWidth, 0);
    container.scrollLeft = Math.min(
      Math.max(clickRatio * totalWidth - track.clientWidth / 2, 0),
      maxScrollLeft,
    );
  }

  // One delegated click listener for every mark in all three lanes, keyed
  // off the data-entity-id/data-entity-type attributes each Lane sets on
  // its .d3-line/.d3-dot elements (dynamic-tooltips spec §2) — avoids
  // wiring the same click handler three times over, and composes cleanly
  // with the drag-to-pan pointer handlers already on this same container.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function handleClick(event: MouseEvent) {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      // Resolving the mark via a fresh hit-test at the click's real screen
      // position, not event.target: this container's own drag-to-pan
      // handler calls setPointerCapture on pointerdown, which retargets
      // the resulting click event's target to the container itself (a
      // browser-level side effect of pointer capture on the compatibility
      // mouse event) — event.target.closest() would then never find a
      // mark for a real mouse click, only for a synthetic one. jsdom
      // doesn't implement elementFromPoint at all (the method itself is
      // absent, hence the optional call), so this falls back to
      // event.target there, which is exactly what a synthetic
      // fireEvent.click(mark) in tests already sets correctly.
      const hit = document.elementFromPoint?.(event.clientX, event.clientY) ?? event.target;
      if (!(hit instanceof Element)) return;
      const mark = hit.closest<SVGElement>('[data-entity-id]');
      if (!mark) return;
      const id = mark.getAttribute('data-entity-id');
      const entityTypeAttr = mark.getAttribute('data-entity-type');
      // Validated against the real EntityType union, not just cast — a
      // future Lane bug or a stray data-entity-id-bearing element added
      // elsewhere in the scroll container should fail closed (no click
      // reported) rather than silently being treated as a milestone, which
      // is what App.tsx's id lookup falls through to for any unrecognized
      // entityType.
      const entityType = ENTITY_TYPES.find((candidate) => candidate === entityTypeAttr);
      if (!id || !entityType) return;
      onEntityClick({ id, entityType });
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onEntityClick]);

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
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis xScale={scale} visibleStartYear={visibleStartYear} visibleEndYear={visibleEndYear} />
        </div>
        <div ref={peopleLaneRef} className={styles.peopleLane}>
          <PeopleLane people={filteredPeople} xScale={scale} />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis xScale={scale} visibleStartYear={visibleStartYear} visibleEndYear={visibleEndYear} />
        </div>
        <div ref={conflictsMilestonesLaneRef} className={styles.conflictsMilestonesLane}>
          <ConflictsMilestonesLane conflicts={filteredConflicts} milestones={filteredMilestones} xScale={scale} />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis xScale={scale} visibleStartYear={visibleStartYear} visibleEndYear={visibleEndYear} />
        </div>
      </div>
      <div ref={trackRef} className={styles.scrollbarTrack} onPointerDown={handleTrackPointerDown}>
        <div
          className={isThumbDragging ? `${styles.scrollbarThumb} ${styles.dragging}` : styles.scrollbarThumb}
          style={{ width: `${thumbWidthRatio * 100}%`, left: `${thumbLeftRatio * 100}%` }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={endThumbDrag}
          onPointerCancel={endThumbDrag}
        />
      </div>
    </div>
  );
}
