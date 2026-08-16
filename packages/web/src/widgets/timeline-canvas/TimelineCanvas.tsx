import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as d3 from 'd3';
import type { Milestone, Person, ConflictEntry, OccupationDomain, Region } from '../../shared/types';
import { DEFAULT_VIEWPORT_START, UN_REGION_TO_REGION, type ConflictsMilestonesFilterValue } from '../../shared/config';
import { m } from '../../shared/paraglide/messages.js';
import { motionDurationMs } from '../../shared/lib/motion';
import { useIsMobileViewport } from '../../shared/lib/viewport';
import type { FameScoreValues, FilteredCounts } from '../../features/filter-by-fame-score';
import { ENTITY_TYPES, type SelectedEntityRef } from '../../features/select-timeline-entity';
import {
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  buildXScale,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  defaultPixelsPerYear,
  FALLBACK_VIEWPORT_WIDTH_PX,
  MIN_YEAR,
  MOBILE_DEFAULT_VISIBLE_YEARS,
  pinchCenterYear,
  pinchPixelsPerYear,
  VIEWPORT_BUFFER_RATIO,
  zoomAnimationDurationMs,
  zoomAnimationGroupTransform,
  zoomAnimationGroupTransformCss,
  zoomIn as computeZoomIn,
  zoomOut as computeZoomOut,
  type ZoomAnimationHandle,
  type ZoomAnimationTransform,
} from './options';
import {
  computeStaticConflictsMilestonesRows,
  computeStaticPersonRows,
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
  // Mobile-only drawer toggle state, owned by App.tsx and shared with
  // Sidebar — the toggle button itself lives here (mirroring the existing
  // zoom-controls overlay's position, top-left instead of top-right)
  // despite the drawer it opens living in a different widget.
  isFilterDrawerOpen: boolean;
  onToggleFilterDrawer: () => void;
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
  isFilterDrawerOpen,
  onToggleFilterDrawer,
}: TimelineCanvasProps) {
  const isMobileViewport = useIsMobileViewport();
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
  // Imperative per-tick targets for the zoom-button animation's single rAF
  // driver (see the zoom() function below) — one wrapping group transform
  // per lane/axis, not per-mark attribute recompute (options.ts's
  // ZoomAnimationTransform comment). gridlineLayerRef is a plain DOM ref
  // (no component-owned imperative handle needed) since the gridline layer
  // is rendered directly here, not inside a Lane/Axis component.
  const peopleLaneAnimRef = useRef<ZoomAnimationHandle>(null);
  const conflictsMilestonesLaneAnimRef = useRef<ZoomAnimationHandle>(null);
  const yearAxisTopAnimRef = useRef<ZoomAnimationHandle>(null);
  const yearAxisMiddleAnimRef = useRef<ZoomAnimationHandle>(null);
  const yearAxisBottomAnimRef = useRef<ZoomAnimationHandle>(null);
  const gridlineLayerRef = useRef<HTMLDivElement>(null);
  // In-flight zoom animation state: rAF handle to cancel on interrupt/
  // unmount, the pixelsPerYear the interpolation is currently retargeting
  // from (null when idle — a fresh click then starts from committed
  // state), and the last *requested* target (so a rapid double-click chains
  // full zoom steps the same way the old instant-zoom did, rather than
  // stepping from wherever the animation happens to be mid-flight).
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const zoomAnimationCurrentPixelsPerYearRef = useRef<number | null>(null);
  const zoomAnimationTargetPixelsPerYearRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (zoomAnimationFrameRef.current !== null) cancelAnimationFrame(zoomAnimationFrameRef.current);
    },
    [],
  );
  // rAF handle for a MountainProfile track click-to-jump's eased scroll —
  // separate from zoomAnimationFrameRef since the two never overlap (a jump
  // doesn't change pixelsPerYear) but each needs its own cancel-on-interrupt.
  const panAnimationFrameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (panAnimationFrameRef.current !== null) cancelAnimationFrame(panAnimationFrameRef.current);
    },
    [],
  );
  // Cancels any in-flight jump animation so a real pointer drag (canvas
  // drag-to-pan, or MountainProfile's own rect drag) always wins instead of
  // fighting the animation's per-frame scrollLeft writes.
  const cancelPanAnimation = useCallback(() => {
    if (panAnimationFrameRef.current !== null) {
      cancelAnimationFrame(panAnimationFrameRef.current);
      panAnimationFrameRef.current = null;
    }
  }, []);
  // Drag-to-pan state: mouse-only (touch already gets native scroll-by-swipe
  // on the overflow-x container for free, and layering pointer-drag on top
  // of that would double-handle touch input). Start position lives in a ref
  // since it's read/written every pointermove but never needs to trigger a
  // render; isDragging is state purely to toggle the grab/grabbing cursor.
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; scrollLeft: number; moved: boolean } | null>(null);
  // Pinch-to-zoom pointer tracking: a separate axis from mouse drag-to-pan
  // above, engaging only once two concurrent non-mouse pointers are down on
  // the same .scrollContainer (mouse drag and touch pinch never both engage
  // for the same gesture — see handlePointerDown's dispatch below). Keyed
  // by pointerId so either finger can lift first. pinchStartRef holds the
  // gesture's fixed reference frame (mirrors zoom()'s own
  // domReferencePixelsPerYear/centerYear/scrollLeftStart pattern below) —
  // null while no two-finger gesture is in progress.
  const pinchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{
    distancePx: number;
    startPixelsPerYear: number;
    centerYear: number;
    scrollLeftStart: number;
    clientWidthPx: number;
  } | null>(null);
  // Live pixelsPerYear the in-flight pinch gesture is currently rendering
  // at (via the same applyZoomAnimationTick transform path button-zoom
  // uses) — read at gesture end to commit real state exactly once, same
  // "commit once, at the end" shape as the button-zoom's
  // zoomAnimationCurrentPixelsPerYearRef.
  const pinchCurrentPixelsPerYearRef = useRef<number | null>(null);
  // Set by endDrag when a drag moved past DRAG_CLICK_SUPPRESSION_PX, read
  // and cleared by the delegated click listener below — a mouseup after a
  // real drag still fires a native click at the release point, which would
  // otherwise open whatever mark/label happens to be under the pointer when
  // the user was only trying to pan, not select something.
  const suppressNextClickRef = useRef(false);
  // The lazy useState initializer runs exactly once, at mount, so reading
  // isMobileViewport here already captures its mount-time value without
  // needing a separate ref — same "first paint" scope the mobile default
  // zoom decision calls for (options.ts's MOBILE_DEFAULT_VISIBLE_YEARS).
  const [pixelsPerYear, setPixelsPerYear] = useState(() =>
    defaultPixelsPerYear(0, isMobileViewport ? MOBILE_DEFAULT_VISIBLE_YEARS : undefined),
  );
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
  // The two sticky lanes' (position: sticky) internal horizontal pan is
  // driven by mirroring scrollRef's scrollLeft onto them (see the ref
  // comment above) — mirroring it only from the throttled native-scroll
  // listener below (one requestAnimationFrame behind) is fine for a
  // continuous drag (the lag is masked by the next frame's motion), but
  // leaves a one-frame visible flash for any *discrete* programmatic jump
  // (zoom re-centering, mount positioning, MountainProfile's click/drag-to-
  // jump): the real geometry commits instantly, the lane's own pan doesn't
  // catch up until the next frame. Every place that writes
  // scrollRef.current.scrollLeft directly calls this instead, so the mirror
  // always lands in the same synchronous step.
  const mirrorLaneScrollLeft = useCallback((newScrollLeft: number) => {
    if (peopleLaneRef.current) peopleLaneRef.current.scrollLeft = newScrollLeft;
    if (conflictsMilestonesLaneRef.current) conflictsMilestonesLaneRef.current.scrollLeft = newScrollLeft;
  }, []);
  // Stable identity (only refs in its closure) so effects that call it can
  // list it as a dependency without it forcing a re-run every render.
  const syncScrollLeft = useCallback(
    (newScrollLeft: number) => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollLeft = newScrollLeft;
      mirrorLaneScrollLeft(newScrollLeft);
    },
    [mirrorLaneScrollLeft],
  );
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollLeft(container.scrollLeft);
        mirrorLaneScrollLeft(container.scrollLeft);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mirrorLaneScrollLeft]);
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

  // Each item's permanent row identity, computed once against the full,
  // unfiltered datasets (people/conflicts/milestones are stable references
  // for the whole session, so these only ever run once) — see
  // map-to-items.ts's computeStaticPersonRows/
  // computeStaticConflictsMilestonesRows for why this can't be derived from
  // filteredPeople/filteredConflicts/filteredMilestones instead.
  const staticPersonRowOf = useMemo(() => computeStaticPersonRows(people), [people]);
  const staticConflictsMilestonesRowOf = useMemo(
    () => computeStaticConflictsMilestonesRows(conflicts, milestones),
    [conflicts, milestones],
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
  //
  // PeopleLane's own svg height (bottom-anchored) now grows/shrinks via a
  // D3 transition, not an instant React attribute (see PeopleLane.tsx), so
  // scrollHeight right after this commit can still be the *pre*-transition
  // value — pinning scrollTop to it here is correct at that instant but goes
  // stale once the svg keeps growing, leaving a small unscrolled gap at the
  // bottom once the transition settles. A ResizeObserver on the svg (not
  // .peopleLane itself, which has a fixed flex height and never resizes)
  // re-applies the same pin on every layout change through the rest of the
  // transition, so scrollTop tracks scrollHeight the whole way, not just at
  // the start. Not available in the jsdom test environment — the instant
  // pin below still covers that case.
  useLayoutEffect(() => {
    const el = peopleLaneRef.current;
    if (!el) return;
    const pinToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    pinToBottom();
    if (typeof ResizeObserver === 'undefined') return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    const observer = new ResizeObserver(pinToBottom);
    observer.observe(svg);
    return () => observer.disconnect();
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
    measuredPixelsPerYearRef.current = defaultPixelsPerYear(
      container.clientWidth,
      isMobileViewport ? MOBILE_DEFAULT_VISIBLE_YEARS : undefined,
    );
    setPixelsPerYear(measuredPixelsPerYearRef.current);
    setViewportWidthPx(container.clientWidth);
  }, [isMobileViewport]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // A zoom animation's rAF loop writes a transform straight to
    // gridlineLayerRef every tick, without going through React — reset it
    // here, in the same effect that lands the real scrollLeft for a
    // committed pixelsPerYear, so the commit is atomic (see PeopleLane's
    // identical comment on its own g.people reset for why).
    if (gridlineLayerRef.current) gridlineLayerRef.current.style.transform = '';
    if (pendingCenterYearRef.current !== null) {
      syncScrollLeft(scale(pendingCenterYearRef.current) - container.clientWidth / 2);
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
      syncScrollLeft(scale(DEFAULT_VIEWPORT_START.year));
      setScrollLeft(container.scrollLeft);
    }
  }, [pixelsPerYear, scale, syncScrollLeft]);

  // Second pointer's pointerdown: the gesture's fixed reference frame,
  // captured once — the same technique zoom() below uses to compute
  // centerYear for button-zoom, just anchored to the pinch midpoint instead
  // of the viewport center.
  function handlePinchPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (!container) return;
    pinchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchPointersRef.current.size !== 2) return;
    cancelPanAnimation();
    const [pointA, pointB] = Array.from(pinchPointersRef.current.values());
    if (!pointA || !pointB) return;
    const distancePx = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
    const midpointClientX = (pointA.x + pointB.x) / 2;
    const rect = container.getBoundingClientRect();
    const scrollLeftStart = container.scrollLeft;
    const clientWidthPx = container.clientWidth;
    pinchStartRef.current = {
      distancePx,
      startPixelsPerYear: pixelsPerYear,
      centerYear: pinchCenterYear(scale, scrollLeftStart, midpointClientX - rect.left),
      scrollLeftStart,
      clientWidthPx,
    };
  }

  // Recomputes the live two-point distance on every subsequent pointermove
  // and feeds it straight into applyZoomAnimationTick — the same cheap
  // group-transform path the button-zoom's rAF tick() uses, so marks scale
  // visually without a full per-mark re-render for the whole gesture.
  function handlePinchPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pinchPointersRef.current.has(event.pointerId)) return;
    pinchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = pinchStartRef.current;
    if (!start || pinchPointersRef.current.size !== 2) return;
    const [pointA, pointB] = Array.from(pinchPointersRef.current.values());
    if (!pointA || !pointB) return;
    const currentDistancePx = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
    const currentPixelsPerYear = pinchPixelsPerYear(
      start.startPixelsPerYear,
      start.distancePx,
      currentDistancePx,
      start.clientWidthPx,
    );
    pinchCurrentPixelsPerYearRef.current = currentPixelsPerYear;
    applyZoomAnimationTick(
      zoomAnimationGroupTransform({
        startPixelsPerYear: start.startPixelsPerYear,
        currentPixelsPerYear,
        minYear: MIN_YEAR,
        centerYear: start.centerYear,
        scrollLeftStart: start.scrollLeftStart,
        clientWidthPx: start.clientWidthPx,
      }),
    );
  }

  // The second-to-last pointer's pointerup/pointercancel ends the gesture —
  // commits exactly once, the same single-commit-at-gesture-end pattern the
  // button-zoom's tick() performs at t === 1. No discrete zoom-step list to
  // snap to: the gesture's own live distance ratio is what commits, already
  // clamped by pinchPixelsPerYear's reuse of clampPixelsPerYear.
  function endPinch(event: ReactPointerEvent<HTMLDivElement>) {
    pinchPointersRef.current.delete(event.pointerId);
    const start = pinchStartRef.current;
    if (!start || pinchPointersRef.current.size >= 2) return;
    pinchStartRef.current = null;
    const finalPixelsPerYear = pinchCurrentPixelsPerYearRef.current ?? start.startPixelsPerYear;
    pinchCurrentPixelsPerYearRef.current = null;
    pendingCenterYearRef.current = start.centerYear;
    setPixelsPerYear(finalPixelsPerYear);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      handlePinchPointerDown(event);
      return;
    }
    if (event.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    cancelPanAnimation();
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
    if (event.pointerType !== 'mouse') {
      handlePinchPointerMove(event);
      return;
    }
    const drag = dragStartRef.current;
    const container = scrollRef.current;
    if (!drag || !container) return;
    const totalOffset = event.clientX - drag.pointerX;
    if (Math.abs(totalOffset) > DRAG_CLICK_SUPPRESSION_PX) drag.moved = true;
    syncScrollLeft(drag.scrollLeft - totalOffset);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      endPinch(event);
      return;
    }
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
  // scrollLeft directly (and, via syncScrollLeft, the sticky lanes' own
  // mirrored pan in the same synchronous step); the scroll listener effect
  // above (with its rAF) is what then updates the scrollLeft state driving
  // MountainProfile's own re-render, same as a native user scroll.
  function handleScrollLeftChange(newScrollLeft: number) {
    cancelPanAnimation();
    syncScrollLeft(newScrollLeft);
  }

  // MountainProfile's track click-to-jump: unlike every other pan source
  // above, this is a single discrete target with no pointer to track, so it
  // eases the lanes/axis toward it (mirrors the zoom-button animation's rAF
  // + d3 interpolation, just for scrollLeft instead of pixelsPerYear)
  // instead of snapping straight there.
  function handleTrackJump(targetScrollLeft: number) {
    const container = scrollRef.current;
    if (!container) return;
    cancelPanAnimation();
    const startScrollLeft = container.scrollLeft;
    const durationMs = motionDurationMs('--motion-duration-base');
    if (durationMs <= 0) {
      syncScrollLeft(targetScrollLeft);
      return;
    }
    const interpolateScrollLeft = d3.interpolateNumber(startScrollLeft, targetScrollLeft);
    let startTimeMs: number | null = null;

    function tick(nowMs: number) {
      if (startTimeMs === null) startTimeMs = nowMs;
      const elapsedMs = nowMs - startTimeMs;
      const t = Math.min(1, elapsedMs / durationMs);
      syncScrollLeft(interpolateScrollLeft(d3.easeCubicInOut(t)));

      if (t < 1) {
        panAnimationFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      panAnimationFrameRef.current = null;
    }

    panAnimationFrameRef.current = requestAnimationFrame(tick);
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

  // Writes one tick's worth of ZoomAnimationTransform to every animated
  // surface — the single rAF driver in zoom() below calls this every frame,
  // rather than each lane/axis running its own loop (ticket 02's "one
  // driver" requirement), so nothing can lag or desync from the others when
  // interrupted.
  function applyZoomAnimationTick(transform: ZoomAnimationTransform) {
    peopleLaneAnimRef.current?.applyZoomTransform(transform);
    conflictsMilestonesLaneAnimRef.current?.applyZoomTransform(transform);
    yearAxisTopAnimRef.current?.applyZoomTransform(transform);
    yearAxisMiddleAnimRef.current?.applyZoomTransform(transform);
    yearAxisBottomAnimRef.current?.applyZoomTransform(transform);
    if (gridlineLayerRef.current) {
      gridlineLayerRef.current.style.transform = zoomAnimationGroupTransformCss(transform);
    }
  }

  // Animates the +/- zoom buttons: every mark stays drawn at the DOM's real,
  // currently-committed pixelsPerYear for the whole gesture (never
  // recomputed per frame — the 250-530ms/frame cost that sank a prior
  // attempt) while a single group transform per lane/axis, written directly
  // via rAF, makes them visually track an eased interpolation toward the
  // target. The real pixelsPerYear/scrollLeft state commits exactly once,
  // at the end (see the existing useLayoutEffect below, keyed on
  // pixelsPerYear, which already implements the deferred-until-DOM-actually-
  // widens commit pattern this reuses unchanged).
  function zoom(step: (currentPixelsPerYear: number, viewportWidthPx: number) => number) {
    const container = scrollRef.current;
    if (!container) {
      setPixelsPerYear((current) => step(current, 0));
      return;
    }
    const clientWidthPx = container.clientWidth;
    // Read once, before any animation frame runs — real scrollLeft is held
    // fixed for the whole gesture (folded into the transform's tx instead),
    // so this stays valid across however many clicks retarget it.
    const scrollLeftStart = container.scrollLeft;
    const centerYear = scale.invert(scrollLeftStart + clientWidthPx / 2);
    // The DOM's real geometry is still drawn at the last *committed*
    // pixelsPerYear — that never changes mid-gesture (see above), so it's
    // the fixed reference every tick's transform is computed relative to.
    const domReferencePixelsPerYear = pixelsPerYear;
    // A fresh click starts interpolating from wherever the animation
    // currently is (or committed state, if idle) — a retarget, not a reset
    // to the original start or a stale target (ticket 01's interrupt
    // requirement). The *target*, though, chains off the last *requested*
    // target (or committed state, if idle), matching the old instant-zoom's
    // behavior where a rapid double-click compounds two full zoom steps.
    const interpolateFromPixelsPerYear = zoomAnimationCurrentPixelsPerYearRef.current ?? domReferencePixelsPerYear;
    const targetPixelsPerYear = step(
      zoomAnimationTargetPixelsPerYearRef.current ?? domReferencePixelsPerYear,
      clientWidthPx,
    );
    zoomAnimationTargetPixelsPerYearRef.current = targetPixelsPerYear;

    setViewportWidthPx(clientWidthPx);

    if (zoomAnimationFrameRef.current !== null) {
      cancelAnimationFrame(zoomAnimationFrameRef.current);
      zoomAnimationFrameRef.current = null;
    }

    // Scaling the live --motion-duration-base token (not a bare literal)
    // rather than reusing it directly, per the spec's "longer than
    // --motion-duration-base" call — this also means the animation
    // collapses to near-zero automatically under prefers-reduced-motion,
    // same as every other motion in the app, with no separate handling
    // needed: the tick loop below already resolves in a frame or two once
    // durationMs is that small.
    const durationMs = zoomAnimationDurationMs(motionDurationMs('--motion-duration-base'));
    const interpolatePixelsPerYear = d3.interpolateNumber(interpolateFromPixelsPerYear, targetPixelsPerYear);
    let startTimeMs: number | null = null;

    function tick(nowMs: number) {
      if (startTimeMs === null) startTimeMs = nowMs;
      const elapsedMs = nowMs - startTimeMs;
      const t = durationMs <= 0 ? 1 : Math.min(1, elapsedMs / durationMs);
      const currentPixelsPerYear = interpolatePixelsPerYear(d3.easeCubicInOut(t));
      zoomAnimationCurrentPixelsPerYearRef.current = currentPixelsPerYear;
      applyZoomAnimationTick(
        zoomAnimationGroupTransform({
          startPixelsPerYear: domReferencePixelsPerYear,
          currentPixelsPerYear,
          minYear: MIN_YEAR,
          centerYear,
          scrollLeftStart,
          clientWidthPx,
        }),
      );

      if (t < 1) {
        zoomAnimationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      zoomAnimationFrameRef.current = null;
      zoomAnimationCurrentPixelsPerYearRef.current = null;
      zoomAnimationTargetPixelsPerYearRef.current = null;
      // The commit: real state changes exactly once here, deferred via the
      // existing pixelsPerYear-keyed useLayoutEffect below (which sets
      // container.scrollLeft only once the new xScale has actually landed)
      // — every lane/axis's own layout effect resets its transform back to
      // identity in that same commit (see e.g. PeopleLane's), so this never
      // needs to reset applyZoomAnimationTick's writes itself.
      pendingCenterYearRef.current = centerYear;
      setPixelsPerYear(targetPixelsPerYear);
    }

    zoomAnimationFrameRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className={styles.wrapper}>
      {isMobileViewport && (
        <button
          type="button"
          className={styles.drawerToggle}
          onClick={onToggleFilterDrawer}
          aria-label={m.filtersAriaLabel()}
          aria-expanded={isFilterDrawerOpen}
        >
          ☰
        </button>
      )}
      <div className={styles.zoomControls}>
        <button type="button" onClick={() => zoom(computeZoomIn)} aria-label={m.zoomInAriaLabel()}>
          +
        </button>
        <button type="button" onClick={() => zoom(computeZoomOut)} aria-label={m.zoomOutAriaLabel()}>
          −
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
        <div ref={gridlineLayerRef} className={styles.gridlineLayer} style={{ width: totalWidth }}>
          <div className={styles.gridline} style={bceGridlineStyle} />
          <div className={styles.gridline} style={ceGridlineStyle} />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis
            ref={yearAxisTopAnimRef}
            xScale={scale}
            visibleStartYear={visibleStartYear}
            visibleEndYear={visibleEndYear}
          />
        </div>
        <div ref={peopleLaneRef} className={styles.peopleLane}>
          <PeopleLane ref={peopleLaneAnimRef} people={filteredPeople} xScale={scale} staticRowOf={staticPersonRowOf} />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis
            ref={yearAxisMiddleAnimRef}
            xScale={scale}
            visibleStartYear={visibleStartYear}
            visibleEndYear={visibleEndYear}
          />
        </div>
        <div ref={conflictsMilestonesLaneRef} className={styles.conflictsMilestonesLane}>
          <ConflictsMilestonesLane
            ref={conflictsMilestonesLaneAnimRef}
            conflicts={filteredConflicts}
            milestones={filteredMilestones}
            xScale={scale}
            staticRowOf={staticConflictsMilestonesRowOf}
          />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis
            ref={yearAxisBottomAnimRef}
            xScale={scale}
            visibleStartYear={visibleStartYear}
            visibleEndYear={visibleEndYear}
          />
        </div>
      </div>
      {!isMobileViewport && (
        <MountainProfile
          people={filteredPeople}
          conflicts={filteredConflicts}
          milestones={filteredMilestones}
          totalWidth={totalWidth}
          viewportWidthPx={viewportWidthPx}
          scrollLeft={scrollLeft}
          onScrollLeftChange={handleScrollLeftChange}
          onScrollLeftJump={handleTrackJump}
        />
      )}
    </div>
  );
}
