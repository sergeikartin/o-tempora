import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Milestone, Person, ConflictEntry, OccupationDomain, Region } from '../../shared/types';
import { DEFAULT_VIEWPORT_START, UN_REGION_TO_REGION, type ConflictsMilestonesFilterValue } from '../../shared/config';
import type { FameScoreValues, FilteredCounts } from '../../features/filter-by-fame-score';
import { ENTITY_TYPES, type SelectedEntityRef } from '../../features/select-timeline-entity';
import {
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  buildXScale,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  defaultPixelsPerYear,
  FALLBACK_VIEWPORT_WIDTH_PX,
  VIEWPORT_BUFFER_RATIO,
  zoomIn as computeZoomIn,
  zoomOut as computeZoomOut,
} from './options';
import {
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
} from './map-to-items';
import { PeopleLane } from './PeopleLane';
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import { YearAxis } from './YearAxis';
import { MountainProfile } from './MountainProfile';
import styles from './TimelineCanvas.module.css';

// Below this much total pointer movement, a mouse-drag is treated as a click
// (e.g. a hand that isn't perfectly still on mousedown) rather than a pan —
// see suppressNextClickRef below.
const DRAG_CLICK_SUPPRESSION_PX = 4;

interface TimelineCanvasProps {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // Sidebar-set fame-score floors (ADR 0003) — zoom no longer drives entity
  // density, so this is a plain prop, not derived from pixelsPerYear.
  fameScoreValues: FameScoreValues;
  // People-only Occupation Domain filter (grill-with-docs session
  // 2026-08-12) — empty means unfiltered.
  selectedDomains: OccupationDomain[];
  // Shared Region filter, one control across all three lanes (grill-with-
  // docs session 2026-08-12) — empty means unfiltered.
  selectedRegions: Region[];
  // Conflicts & Milestones filter — one shared multi-select spanning the
  // 'conflicts' sentinel and the 3 MilestoneCategoryGroup values (revised
  // 2026-08-12 to mirror Region/Occupation Domain's shape instead of a
  // separate group-filter + boolean-toggle pair) — empty means unfiltered.
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  // Reports a click on any lane's mark, resolved via one delegated listener
  // below rather than three separate per-lane click handlers (dynamic-
  // tooltips spec §2's click-wiring architecture) — the caller (App.tsx)
  // owns looking the id up in the full in-memory dataset and opening the
  // detail drawer.
  onEntityClick: (ref: SelectedEntityRef) => void;
  // Reports post-filter entry counts per lane whenever they change, so
  // App.tsx can thread them to the Sidebar's fame-score inputs — this
  // widget stays the single owner of the filtering pipeline (per
  // docs/code-conventions.md) rather than App re-deriving the same counts
  // with a second copy of filterByFameScore/filterByOccupationDomain/
  // filterByRegion.
  onFilteredCountsChange?: (counts: FilteredCounts) => void;
}

export function TimelineCanvas({
  people,
  conflicts,
  milestones,
  fameScoreValues,
  selectedDomains,
  selectedRegions,
  selectedConflictsMilestonesValues,
  onEntityClick,
  onFilteredCountsChange,
}: TimelineCanvasProps) {
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

  // Faint full-height decade gridlines (.gridlineLayer in
  // TimelineCanvas.module.css) — same BCE/CE phase split as YearAxis's own
  // ruler (see its comment): round-historical BCE tick positions sit on a
  // different phase than CE ones, so this renders as two adjacent regions
  // split at year 0 rather than one continuous background.
  const gridlineBoundaryX = Math.min(Math.max(scale(0), 0), totalWidth);
  const gridlineSizePx = `${pixelsPerYear * DECADE_STEP_YEARS}px`;
  const bceGridlineStyle = {
    width: gridlineBoundaryX,
    '--decade-gridline-px': gridlineSizePx,
    '--decade-gridline-offset-px': `${pixelsPerYear * BCE_DECADE_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const ceGridlineStyle = {
    width: totalWidth - gridlineBoundaryX,
    '--decade-gridline-px': gridlineSizePx,
    '--decade-gridline-offset-px': `${pixelsPerYear * DECADE_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const filteredPeople = useMemo(
    () =>
      filterByRegion(
        filterByOccupationDomain(filterByFameScore(people, fameScoreValues.people), selectedDomains),
        selectedRegions,
        // Person's regionTags is the finer 22-value UnRegion, not Region —
        // translate to the shared 6-value scale at filter time (see
        // shared/config/region.ts's UN_REGION_TO_REGION).
        (person) => person.regionTags.map((subRegion) => UN_REGION_TO_REGION[subRegion]),
      ),
    [people, fameScoreValues.people, selectedDomains, selectedRegions],
  );
  const filteredConflicts = useMemo(
    () =>
      filterConflictsByFilterValues(
        filterByRegion(filterByFameScore(conflicts, fameScoreValues.conflicts), selectedRegions, (entry) => entry.regionTags),
        selectedConflictsMilestonesValues,
      ),
    [conflicts, fameScoreValues.conflicts, selectedRegions, selectedConflictsMilestonesValues],
  );
  const filteredMilestones = useMemo(
    () =>
      filterByMilestoneCategoryGroup(
        filterByRegion(filterByFameScore(milestones, fameScoreValues.milestones), selectedRegions, (milestone) => milestone.regionTags),
        selectedConflictsMilestonesValues,
      ),
    [milestones, fameScoreValues.milestones, selectedRegions, selectedConflictsMilestonesValues],
  );

  const filteredCounts = useMemo<FilteredCounts>(
    () => ({ people: filteredPeople.length, conflicts: filteredConflicts.length, milestones: filteredMilestones.length }),
    [filteredPeople, filteredConflicts, filteredMilestones],
  );
  // useLayoutEffect (not useEffect) so a filter change's new counts land in
  // the Sidebar's DOM before the browser paints, avoiding a one-frame flash
  // of the stale count.
  useLayoutEffect(() => {
    onFilteredCountsChange?.(filteredCounts);
  }, [filteredCounts, onFilteredCountsChange]);

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

  // Passed to MountainProfile (replaces the old scrollbar's own direct
  // container.scrollLeft assignments, ADR 0004) — sets the real DOM
  // scrollLeft directly; the scroll listener effect above (with its rAF)
  // is what then updates the scrollLeft state driving MountainProfile's own
  // re-render, same as a native user scroll.
  function handleScrollLeftChange(newScrollLeft: number) {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollLeft = newScrollLeft;
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.gridlineLayer} style={{ width: totalWidth }}>
          <div className={styles.gridline} style={bceGridlineStyle} />
          <div className={styles.gridline} style={ceGridlineStyle} />
        </div>
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
      <MountainProfile
        people={filteredPeople}
        conflicts={filteredConflicts}
        milestones={filteredMilestones}
        totalWidth={totalWidth}
        viewportWidthPx={viewportWidthPx}
        scrollLeft={scrollLeft}
        onScrollLeftChange={handleScrollLeftChange}
      />
    </div>
  );
}
