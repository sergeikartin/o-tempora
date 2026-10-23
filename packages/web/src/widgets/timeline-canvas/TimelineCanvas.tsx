import * as d3 from 'd3';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  FameScoreValues,
  FilteredCounts,
} from '../../features/filter-by-fame-score';
import {
  ENTITY_TYPES,
  type SelectedEntityRef,
} from '../../features/select-timeline-entity';
import {
  type ConflictsMilestonesFilterValue,
  DEFAULT_VIEWPORT_START_YEAR,
} from '../../shared/config';
import { centuryBoundaryForYear } from '../../shared/lib/date';
import { motionDurationMs } from '../../shared/lib/motion';
import { trackEvent } from '../../shared/lib/track-event';
import { useIsMobileViewport } from '../../shared/lib/viewport';
import { m } from '../../shared/paraglide/messages.js';
import type {
  ConflictEntry,
  Milestone,
  OccupationDomain,
  Person,
  Region,
} from '../../shared/types';
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import { Minimap } from './Minimap';
import {
  computeRowAssignment,
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
  mapConflicts,
  mapMilestones,
  mapPeople,
} from './map-to-items';
import {
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS,
  buildXScale,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  zoomIn as computeZoomIn,
  zoomOut as computeZoomOut,
  FALLBACK_VIEWPORT_WIDTH_PX,
  MIN_YEAR,
  pinchCenterYear,
  pinchPixelsPerYear,
  QUARTER_CENTURY_STEP_YEARS,
  QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS,
  REFERENCE_PIXELS_PER_YEAR,
  VIEWPORT_BUFFER_RATIO,
  type ZoomAnimationHandle,
  type ZoomAnimationTransform,
  zoomAnimationDurationMs,
  zoomAnimationGroupTransform,
  zoomAnimationGroupTransformCss,
} from './options';
import { PeopleLane } from './PeopleLane';
import styles from './TimelineCanvas.module.css';
import { ViewportRange } from './ViewportRange';
import { YearAxis } from './YearAxis';

// Below this much total pointer movement, a mouse-drag counts as a click
// rather than a pan (see suppressNextClickRef).
const DRAG_CLICK_SUPPRESSION_PX = 4;

// A pan gesture fires many native 'scroll' events, so the 'pan' event is
// debounced: it fires this long after the last scroll event in a burst, once
// per gesture (docs/observability.md).
const PAN_TRACK_DEBOUNCE_MS = 500;

// Buckets a viewport-center year into its century (e.g. "1800s", "3rd
// century BCE") so zoom/pan event data stays low-cardinality.
function periodBucket(year: number): string {
  return centuryBoundaryForYear(Math.round(year)).label;
}

interface TimelineCanvasProps {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // Sidebar-set fame-score floors (web/docs/adr/0003), independent of zoom.
  fameScoreValues: FameScoreValues;
  // People-only Occupation Domain filter; empty means unfiltered.
  selectedDomains: OccupationDomain[];
  // Region filter shared by all three lanes; empty means unfiltered.
  selectedRegions: Region[];
  // Conflicts & Milestones filter: the 'conflicts' value and the 2
  // MilestoneCategoryGroup values; empty means unfiltered.
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  // Reports a click on any lane's mark (one delegated listener); App.tsx looks
  // the id up in the full dataset and opens the detail panel.
  onEntityClick: (ref: SelectedEntityRef) => void;
  // Reports post-filter entry counts per lane for the Sidebar; this widget
  // stays the single owner of the filtering pipeline (docs/code-conventions.md).
  onFilteredCountsChange?: (counts: FilteredCounts) => void;
  // Mobile drawer toggle state, owned by App.tsx and shared with Sidebar. The
  // toggle button lives here, beside the zoom controls.
  isFilterDrawerOpen: boolean;
  onToggleFilterDrawer: () => void;
  // The entity DetailPanel is open for (canvas click or search pick), or null.
  // Its mark gets the selection highlight while it stays selected.
  selectedEntity?: SelectedEntityRef | null;
  // Set only by a search pick (a canvas click is already in view). App.tsx
  // passes a fresh object each time, so re-picking the same result re-jumps.
  searchJumpTarget?: SelectedEntityRef | null;
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
  selectedEntity,
  searchJumpTarget,
}: TimelineCanvasProps) {
  const isMobileViewport = useIsMobileViewport();
  // Minimap mounts at idle time, not in the hydration commit. The prerender
  // assumes desktop (viewport.ts's getServerSnapshot), so on mobile an eager
  // mount would appear and then unmount, resizing .scrollContainer (same flex
  // column) and causing layout shift. Gated on isMinimapIdle (false at SSR and
  // first hydration), it never mounts on mobile.
  const [isMinimapIdle, setIsMinimapIdle] = useState(false);
  useEffect(() => {
    const schedule =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 0));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = schedule(() => setIsMinimapIdle(true));
    return () => cancel(handle);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  // People and Conflicts+Milestones are `position: sticky; left: 0` so each
  // lane's vertical scrollbar stays docked to the viewport's right edge. A
  // sticky element doesn't scroll with scrollRef, so the scroll handler mirrors
  // scrollRef's scrollLeft onto these refs (scrollLeft works on overflow-x:
  // hidden elements; scrollRef alone owns the horizontal gesture).
  const peopleLaneRef = useRef<HTMLDivElement>(null);
  const conflictsMilestonesLaneRef = useRef<HTMLDivElement>(null);
  // Per-tick targets for the zoom animation's single rAF driver (zoom()): one
  // group transform per lane/axis, not per-mark recompute (options.ts's
  // ZoomAnimationTransform). zebraLayerRef is rendered here, so a plain ref.
  const peopleLaneAnimRef = useRef<ZoomAnimationHandle>(null);
  const conflictsMilestonesLaneAnimRef = useRef<ZoomAnimationHandle>(null);
  // The one Year Axis, between People and Conflicts+Milestones. Each lane
  // scrolls internally, so no other copy needs to stay visible.
  const yearAxisMiddleAnimRef = useRef<ZoomAnimationHandle>(null);
  const zebraLayerRef = useRef<HTMLDivElement>(null);
  // In-flight zoom animation state: the rAF handle, the pixelsPerYear being
  // retargeted from (null when idle), and the last requested target, so a rapid
  // double-click chains full zoom steps instead of stepping from mid-flight.
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const zoomAnimationCurrentPixelsPerYearRef = useRef<number | null>(null);
  const zoomAnimationTargetPixelsPerYearRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (zoomAnimationFrameRef.current !== null)
        cancelAnimationFrame(zoomAnimationFrameRef.current);
    },
    [],
  );
  // rAF handle for a Minimap track click-to-jump's eased scroll; separate from
  // zoomAnimationFrameRef because each needs its own cancel-on-interrupt.
  const panAnimationFrameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (panAnimationFrameRef.current !== null)
        cancelAnimationFrame(panAnimationFrameRef.current);
    },
    [],
  );
  // Cancels any in-flight jump animation so a real pointer drag wins.
  const cancelPanAnimation = useCallback(() => {
    if (panAnimationFrameRef.current !== null) {
      cancelAnimationFrame(panAnimationFrameRef.current);
      panAnimationFrameRef.current = null;
    }
  }, []);
  // Drag-to-pan state: mouse-only, since touch already gets native swipe
  // scrolling. The start position is a ref (read every pointermove, no render);
  // isDragging is state only to toggle the pan cursor.
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    scrollLeft: number;
    moved: boolean;
  } | null>(null);
  // Pinch-to-zoom pointer tracking, engaged once two non-mouse pointers are
  // down on .scrollContainer (see handlePointerDown). Keyed by pointerId so
  // either finger can lift first. pinchStartRef is the gesture's fixed
  // reference frame, like zoom()'s domReferencePixelsPerYear/centerYear/
  // scrollLeftStart; null when no pinch is in progress.
  const pinchPointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchStartRef = useRef<{
    distancePx: number;
    startPixelsPerYear: number;
    centerYear: number;
    scrollLeftStart: number;
    clientWidthPx: number;
  } | null>(null);
  // Live pixelsPerYear of the in-flight pinch (rendered through
  // applyZoomAnimationTick); committed to state once at gesture end.
  const pinchCurrentPixelsPerYearRef = useRef<number | null>(null);
  // Set by endDrag after a real drag, cleared by the delegated click listener:
  // the mouseup still fires a click that would otherwise open whatever mark is
  // under the pointer.
  const suppressNextClickRef = useRef(false);
  // A fixed density, not derived from viewport width: the prerendered marks
  // are painted at this density, so a narrower viewport shows fewer years at
  // the same density instead of rescaling and repositioning every mark on
  // hydration.
  const [pixelsPerYear, setPixelsPerYear] = useState(REFERENCE_PIXELS_PER_YEAR);
  // Set by a zoom to the viewport-center year, so the commit effect can
  // re-center on it instead of snapping to the timeline's left edge.
  const pendingCenterYearRef = useRef<number | null>(null);

  const { scale, totalWidth } = useMemo(
    () => buildXScale(pixelsPerYear),
    [pixelsPerYear],
  );
  // Read in the pan debounce's setTimeout callback, which fires after the
  // render that scheduled it and would otherwise close over a stale scale.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // State, not a scrollRef read during render (which React disallows); set on
  // mount measurement and each zoom.
  const [viewportWidthPx, setViewportWidthPx] = useState(0);

  // Drives the Year Axis's viewport-windowed ticks; follows live scroll,
  // unlike viewportWidthPx. Seeded with the default start year's offset so the
  // first render's Viewport Range shows the default window.
  const [scrollLeft, setScrollLeft] = useState(() =>
    Math.max(0, scale(DEFAULT_VIEWPORT_START_YEAR)),
  );
  // Mirrors scrollRef's scrollLeft onto the sticky lanes. The throttled scroll
  // listener alone lags a frame, which flashes on discrete programmatic jumps
  // (zoom re-centering, mount positioning, Minimap jumps), so every direct
  // scrollLeft write calls this to mirror in the same synchronous step.
  const mirrorLaneScrollLeft = useCallback((newScrollLeft: number) => {
    if (peopleLaneRef.current) peopleLaneRef.current.scrollLeft = newScrollLeft;
    if (conflictsMilestonesLaneRef.current)
      conflictsMilestonesLaneRef.current.scrollLeft = newScrollLeft;
  }, []);
  // Stable identity (refs only), so effects can depend on it.
  const syncScrollLeft = useCallback(
    (newScrollLeft: number) => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollLeft = newScrollLeft;
      mirrorLaneScrollLeft(newScrollLeft);
    },
    [mirrorLaneScrollLeft],
  );
  // One-shot: set just before a scrollLeft write that isn't a user pan (mount
  // positioning, zoom re-centering), so the resulting 'scroll' event doesn't
  // restart the pan debounce or re-derive state the writer already set. Consumed
  // by the next scroll event, which fires as a separate task after this write.
  const skipNextPanTrackRef = useRef(false);
  const panTrackTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (skipNextPanTrackRef.current) {
        skipNextPanTrackRef.current = false;
        return;
      }
      if (panTrackTimeoutRef.current !== null) {
        window.clearTimeout(panTrackTimeoutRef.current);
      }
      panTrackTimeoutRef.current = window.setTimeout(() => {
        panTrackTimeoutRef.current = null;
        const centerYear = scaleRef.current.invert(
          container.scrollLeft + container.clientWidth / 2,
        );
        trackEvent('pan', { period: periodBucket(centerYear) });
      }, PAN_TRACK_DEBOUNCE_MS);
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
      if (panTrackTimeoutRef.current !== null) {
        window.clearTimeout(panTrackTimeoutRef.current);
      }
    };
  }, [mirrorLaneScrollLeft]);
  const effectiveViewportWidthPx =
    viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const viewportBufferPx = effectiveViewportWidthPx * VIEWPORT_BUFFER_RATIO;
  const viewportStartYear = scale.invert(scrollLeft);
  const viewportEndYear = scale.invert(scrollLeft + effectiveViewportWidthPx);
  const visibleStartYear = scale.invert(scrollLeft - viewportBufferPx);
  const visibleEndYear = scale.invert(
    scrollLeft + effectiveViewportWidthPx + viewportBufferPx,
  );

  // Full-height 25-year zebra striping (.zebraLayer in
  // TimelineCanvas.module.css) with the same BCE/CE phase split as YearAxis's
  // ruler, so it renders as two regions split at year 0. A second background
  // layer draws the century seam at the same pixelsPerYear, aligned under each
  // century tab. The layer also paints behind the ruler, so the seam runs
  // unbroken from People through Conflicts & Milestones.
  const zebraBoundaryX = Math.min(Math.max(scale(0), 0), totalWidth);
  const zebraBandSizePx = `${pixelsPerYear * QUARTER_CENTURY_STEP_YEARS}px`;
  const centurySeamSizePx = `${pixelsPerYear * CENTURY_STEP_YEARS}px`;
  const bceZebraStyle = {
    width: zebraBoundaryX,
    '--zebra-band-px': zebraBandSizePx,
    '--zebra-offset-px': `${pixelsPerYear * BCE_QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
    '--century-seam-px': centurySeamSizePx,
    '--century-seam-offset-px': `${pixelsPerYear * BCE_CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const ceZebraStyle = {
    width: totalWidth - zebraBoundaryX,
    '--zebra-band-px': zebraBandSizePx,
    '--zebra-offset-px': `${pixelsPerYear * QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
    '--century-seam-px': centurySeamSizePx,
    '--century-seam-offset-px': `${pixelsPerYear * CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const filteredPeople = useMemo(
    () =>
      filterByRegion(
        filterByOccupationDomain(
          filterByFameScore(people, fameScoreValues.people),
          selectedDomains,
        ),
        selectedRegions,
        (person) => person.regionTags,
      ),
    [people, fameScoreValues.people, selectedDomains, selectedRegions],
  );
  const filteredConflicts = useMemo(
    () =>
      filterConflictsByFilterValues(
        filterByRegion(
          filterByFameScore(conflicts, fameScoreValues.conflicts),
          selectedRegions,
          (entry) => entry.regionTags,
        ),
        selectedConflictsMilestonesValues,
      ),
    [
      conflicts,
      fameScoreValues.conflicts,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );
  const filteredMilestones = useMemo(
    () =>
      filterByMilestoneCategoryGroup(
        filterByRegion(
          filterByFameScore(milestones, fameScoreValues.milestones),
          selectedRegions,
          (milestone) => milestone.regionTags,
        ),
        selectedConflictsMilestonesValues,
      ),
    [
      milestones,
      fameScoreValues.milestones,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );

  const filteredCounts = useMemo<FilteredCounts>(
    () => ({
      people: filteredPeople.length,
      conflicts: filteredConflicts.length,
      milestones: filteredMilestones.length,
    }),
    [filteredPeople, filteredConflicts, filteredMilestones],
  );

  // Each item's row, computed once against the full unfiltered datasets (stable
  // references for the session) and shared by PeopleLane,
  // ConflictsMilestonesLane and Minimap so they can't disagree. See
  // map-to-items.ts's computeRowAssignment for why it can't come from the
  // filtered sets.
  const { personRowFor, eventsRowFor } = useMemo(
    () => computeRowAssignment(people, conflicts, milestones),
    [people, conflicts, milestones],
  );
  // useLayoutEffect so new counts land in the Sidebar's DOM before paint, with
  // no one-frame flash of the stale count.
  useLayoutEffect(() => {
    onFilteredCountsChange?.(filteredCounts);
  }, [filteredCounts, onFilteredCountsChange]);

  // Fame-priority row packing puts the most important rows next to the shared
  // Year Axis: bottom of .peopleLane, top of .conflictsMilestonesLane. These
  // effects scroll each lane to its axis-adjacent edge whenever the visible set
  // changes. The Conflicts+Milestones edge is scrollTop 0 and only needs a
  // reset; People's is the bottom and needs scrollHeight (known post-layout,
  // hence useLayoutEffect for both).
  //
  // PeopleLane's svg height grows through a D3 transition, so scrollHeight right
  // after commit can be the pre-transition value and leave a gap at the bottom
  // once it settles. A ResizeObserver on the svg (.peopleLane has a fixed flex
  // height and never resizes) re-pins on every layout change through the
  // transition. Unavailable in jsdom; the instant pin covers that case.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredPeople isn't read in the body — it's a trigger to re-pin scroll whenever the visible item set changes
  useLayoutEffect(() => {
    const el = peopleLaneRef.current;
    if (!el) return;
    // Drives .peopleLane's top fade (TimelineCanvas.module.css): rows above the
    // scroll position are clipped, signalling more above. Set on the element
    // directly because it changes on every scroll tick.
    const updateScrollAffordance = () => {
      el.dataset.hasMoreAbove = String(el.scrollTop > 1);
    };
    const pinToBottom = () => {
      el.scrollTop = el.scrollHeight;
      updateScrollAffordance();
    };
    pinToBottom();
    el.addEventListener('scroll', updateScrollAffordance, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => el.removeEventListener('scroll', updateScrollAffordance);
    }
    const svg = el.querySelector('svg');
    if (!svg) {
      return () => el.removeEventListener('scroll', updateScrollAffordance);
    }
    // rAF-batched: the height transition fires many ResizeObserver callbacks per
    // second and pinToBottom needs to run once per frame.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pinToBottom();
      });
    });
    observer.observe(svg);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', updateScrollAffordance);
    };
  }, [filteredPeople]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredConflicts/filteredMilestones aren't read in the body — they're a trigger to reset scroll whenever the visible item set changes
  useLayoutEffect(() => {
    const el = conflictsMilestonesLaneRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [filteredConflicts, filteredMilestones]);

  // 'timeline-initial-render' performance mark: when the real (not
  // fallback-width) geometry commits. Chrome's LCP heuristic can't see SVG
  // content, so this is the closest signal for "timeline rendered".
  const hasMarkedInitialRenderRef = useRef(false);
  // One effect for mount and every zoom/pinch completion. pixelsPerYear is a
  // fixed constant, so mount needs no second pass for a real value.
  // pendingCenterYearRef tells them apart (null at mount, set by zoom/pinch):
  // measure clientWidth once, then write viewportWidthPx, scrollLeft and the
  // mirrored lanes with no DOM read afterward.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // The zoom animation's rAF loop writes transforms straight to zebraLayerRef,
    // bypassing React; reset it here with the real scrollLeft so the commit is
    // atomic (see PeopleLane's identical reset of its g.people).
    if (zebraLayerRef.current) {
      zebraLayerRef.current.style.transform = '';
      zebraLayerRef.current.style.willChange = '';
    }
    const clientWidthPx = container.clientWidth;
    setViewportWidthPx(clientWidthPx);
    skipNextPanTrackRef.current = true;
    const centerYear = pendingCenterYearRef.current;
    pendingCenterYearRef.current = null;
    const targetScrollLeft =
      centerYear !== null
        ? scale(centerYear) - clientWidthPx / 2
        : scale(DEFAULT_VIEWPORT_START_YEAR);
    const nextScrollLeft = Math.max(
      0,
      Math.min(targetScrollLeft, totalWidth - clientWidthPx),
    );
    syncScrollLeft(nextScrollLeft);
    setScrollLeft(nextScrollLeft);
    if (!hasMarkedInitialRenderRef.current) {
      hasMarkedInitialRenderRef.current = true;
      performance.mark('timeline-initial-render');
    }
  }, [scale, syncScrollLeft, totalWidth]);

  // Second pointerdown: capture the gesture's fixed reference frame, as zoom()
  // does for button zoom, anchored at the pinch midpoint.
  function handlePinchPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    if (!container) return;
    pinchPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pinchPointersRef.current.size !== 2) return;
    cancelPanAnimation();
    beginZoomAnimation();
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
      centerYear: pinchCenterYear(
        scale,
        scrollLeftStart,
        midpointClientX - rect.left,
      ),
      scrollLeftStart,
      clientWidthPx,
    };
  }

  // Feeds the live two-point distance into applyZoomAnimationTick, the same
  // cheap group-transform path as button zoom, so marks scale without a
  // per-mark re-render.
  function handlePinchPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pinchPointersRef.current.has(event.pointerId)) return;
    pinchPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const start = pinchStartRef.current;
    if (!start || pinchPointersRef.current.size !== 2) return;
    const [pointA, pointB] = Array.from(pinchPointersRef.current.values());
    if (!pointA || !pointB) return;
    const currentDistancePx = Math.hypot(
      pointA.x - pointB.x,
      pointA.y - pointB.y,
    );
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

  // The second-to-last pointerup/pointercancel ends the gesture and commits
  // once, like button zoom's tick() at t === 1. The live distance ratio commits
  // directly, clamped by clampPixelsPerYear.
  function endPinch(event: ReactPointerEvent<HTMLDivElement>) {
    pinchPointersRef.current.delete(event.pointerId);
    const start = pinchStartRef.current;
    if (!start || pinchPointersRef.current.size >= 2) return;
    pinchStartRef.current = null;
    const finalPixelsPerYear =
      pinchCurrentPixelsPerYearRef.current ?? start.startPixelsPerYear;
    pinchCurrentPixelsPerYearRef.current = null;
    pendingCenterYearRef.current = start.centerYear;
    setPixelsPerYear(finalPixelsPerYear);
    if (finalPixelsPerYear !== start.startPixelsPerYear) {
      trackEvent('zoom', {
        method: 'pinch',
        direction: finalPixelsPerYear > start.startPixelsPerYear ? 'in' : 'out',
        period: periodBucket(start.centerYear),
      });
    }
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
    dragStartRef.current = {
      pointerX: event.clientX,
      scrollLeft: container.scrollLeft,
      moved: false,
    };
    // Best-effort: keeps the drag alive if the pointer leaves the container.
    // jsdom lacks it and browsers can throw NotFoundError for an inactive
    // pointerId; the drag itself uses dragStartRef, so failures are swallowed.
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
    // A real drag's mouseup still fires a click that would open the mark under
    // the cursor; the delegated click listener checks and clears this flag.
    if (drag.moved) suppressNextClickRef.current = true;
    try {
      scrollRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment
    }
    setIsDragging(false);
  }

  // Passed to Minimap: sets the real scrollLeft (and, via syncScrollLeft, the
  // sticky lanes' pan) directly. The scroll listener above then updates the
  // scrollLeft state that re-renders Minimap, as for a native scroll.
  function handleScrollLeftChange(newScrollLeft: number) {
    cancelPanAnimation();
    syncScrollLeft(newScrollLeft);
  }

  // Minimap's track click-to-jump is one discrete target with no pointer to
  // track, so it eases toward it (rAF + d3 interpolation, like zoom but for
  // scrollLeft) instead of snapping.
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
    const interpolateScrollLeft = d3.interpolateNumber(
      startScrollLeft,
      targetScrollLeft,
    );
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

  // A search pick pans to center the entity (no zoom-to-fit), reusing the
  // eased scroll above, on the midpoint of its start/end (the map* functions
  // already resolve the "still alive"/zero-width cases as the lanes render
  // them).
  //
  // Each lane also scrolls vertically on its own, so a mark away from the
  // fame-priority default position can land outside the viewport. Rather than
  // duplicate each lane's row layout math, find the rendered mark by the
  // data-entity-id attribute the click listener reads and scroll it to the
  // lane's vertical center from its real geometry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only searchJumpTarget should retrigger a jump — handleTrackJump/scale/people/conflicts/milestones are unmemoized and change every render, so including them would refire this on every render once a jump target is set, fighting the user's next pan/zoom
  useEffect(() => {
    if (!searchJumpTarget) return;
    const container = scrollRef.current;
    if (!container) return;
    let centerYear: number | null = null;
    if (searchJumpTarget.entityType === 'person') {
      const item = mapPeople(people).find((p) => p.id === searchJumpTarget.id);
      if (item) centerYear = (item.startYear + item.endYear) / 2;
    } else if (searchJumpTarget.entityType === 'conflict') {
      const item = mapConflicts(conflicts).find(
        (c) => c.id === searchJumpTarget.id,
      );
      if (item) centerYear = (item.startYear + item.endYear) / 2;
    } else {
      const item = mapMilestones(milestones).find(
        (m) => m.id === searchJumpTarget.id,
      );
      if (item) centerYear = (item.startYear + item.endYear) / 2;
    }
    if (centerYear === null) return;
    handleTrackJump(scale(centerYear) - container.clientWidth / 2);

    const laneEl =
      searchJumpTarget.entityType === 'person'
        ? peopleLaneRef.current
        : conflictsMilestonesLaneRef.current;
    const mark = laneEl?.querySelector(
      `[data-entity-id="${searchJumpTarget.id}"]`,
    );
    if (laneEl && mark) {
      const laneRect = laneEl.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const markTopWithinLane = markRect.top - laneRect.top + laneEl.scrollTop;
      laneEl.scrollTop =
        markTopWithinLane - laneEl.clientHeight / 2 + markRect.height / 2;
    }
  }, [searchJumpTarget]);

  // One delegated click listener for every mark in all three lanes, keyed off
  // the data-entity-id/data-entity-type attributes each lane sets; it composes
  // with the drag-to-pan handlers on this container.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    function handleClick(event: MouseEvent) {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      // Hit-test at the click's screen position instead of event.target: this
      // container's drag-to-pan calls setPointerCapture on pointerdown, which
      // retargets the click to the container itself, so event.target.closest()
      // would miss marks on a real mouse click. jsdom lacks elementFromPoint (hence
      // the optional call), and falls back to event.target, which synthetic
      // fireEvent.click(mark) sets correctly.
      const hit =
        document.elementFromPoint?.(event.clientX, event.clientY) ??
        event.target;
      if (!(hit instanceof Element)) return;
      const mark = hit.closest<SVGElement>('[data-entity-id]');
      if (!mark) return;
      const id = mark.getAttribute('data-entity-id');
      const entityTypeAttr = mark.getAttribute('data-entity-type');
      // Validated against the EntityType union rather than cast, so a stray
      // data-entity-id element fails closed instead of being treated as a milestone
      // (App.tsx's lookup fallthrough).
      const entityType = ENTITY_TYPES.find(
        (candidate) => candidate === entityTypeAttr,
      );
      if (!id || !entityType) return;
      onEntityClick({ id, entityType });
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onEntityClick]);

  // Called once at the start of a button-zoom or pinch gesture: promotes every
  // animated surface to its own compositor layer before the first transform
  // write (see ZoomAnimationHandle). Idempotent, so a mid-gesture retarget can
  // call it again.
  function beginZoomAnimation() {
    peopleLaneAnimRef.current?.beginZoomAnimation?.();
    conflictsMilestonesLaneAnimRef.current?.beginZoomAnimation?.();
    yearAxisMiddleAnimRef.current?.beginZoomAnimation?.();
    if (zebraLayerRef.current) {
      zebraLayerRef.current.style.willChange = 'transform';
    }
  }

  // Writes one tick's ZoomAnimationTransform to every animated surface. The
  // single rAF driver in zoom() calls it every frame, so no surface can lag or
  // desync when interrupted.
  function applyZoomAnimationTick(transform: ZoomAnimationTransform) {
    peopleLaneAnimRef.current?.applyZoomTransform(transform);
    conflictsMilestonesLaneAnimRef.current?.applyZoomTransform(transform);
    yearAxisMiddleAnimRef.current?.applyZoomTransform(transform);
    if (zebraLayerRef.current) {
      zebraLayerRef.current.style.transform =
        zoomAnimationGroupTransformCss(transform);
    }
  }

  // Animates the +/- zoom buttons. Every mark stays drawn at the committed
  // pixelsPerYear for the whole gesture (recomputing per frame costs
  // 250-530ms), while one group transform per lane/axis, written via rAF,
  // tracks an eased interpolation to the target. Real pixelsPerYear/scrollLeft
  // state commits once at the end, through the pixelsPerYear-keyed
  // useLayoutEffect.
  function zoom(
    step: (currentPixelsPerYear: number, viewportWidthPx: number) => number,
    direction: 'in' | 'out',
  ) {
    const container = scrollRef.current;
    if (!container) {
      setPixelsPerYear((current) => step(current, 0));
      return;
    }
    beginZoomAnimation();
    const clientWidthPx = container.clientWidth;
    // Read once before any frame: real scrollLeft is held fixed for the whole
    // gesture (folded into the transform's tx), so this stays valid across
    // retargeting clicks.
    const scrollLeftStart = container.scrollLeft;
    const centerYear = scale.invert(scrollLeftStart + clientWidthPx / 2);
    // Zoom re-centers on the starting year (pendingCenterYearRef commit), so
    // this pre-zoom center is the right bucket for the whole gesture.
    trackEvent('zoom', {
      method: 'button',
      direction,
      period: periodBucket(centerYear),
    });
    // The DOM stays drawn at the last committed pixelsPerYear mid-gesture, so
    // it is the fixed reference for every tick's transform.
    const domReferencePixelsPerYear = pixelsPerYear;
    // A click retargets from wherever the animation is (or committed state when
    // idle). The target chains off the last requested target, so a rapid
    // double-click compounds two full zoom steps.
    const interpolateFromPixelsPerYear =
      zoomAnimationCurrentPixelsPerYearRef.current ?? domReferencePixelsPerYear;
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

    // Scales the --motion-duration-base token, so the animation collapses to
    // near-zero under prefers-reduced-motion like all other motion.
    const durationMs = zoomAnimationDurationMs(
      motionDurationMs('--motion-duration-base'),
    );
    const interpolatePixelsPerYear = d3.interpolateNumber(
      interpolateFromPixelsPerYear,
      targetPixelsPerYear,
    );
    let startTimeMs: number | null = null;

    function tick(nowMs: number) {
      if (startTimeMs === null) startTimeMs = nowMs;
      const elapsedMs = nowMs - startTimeMs;
      const t = durationMs <= 0 ? 1 : Math.min(1, elapsedMs / durationMs);
      const currentPixelsPerYear = interpolatePixelsPerYear(
        d3.easeCubicInOut(t),
      );
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
      // The commit: real state changes once here, deferred to the
      // pixelsPerYear-keyed useLayoutEffect, which sets scrollLeft once the new
      // xScale lands. Each lane/axis resets its transform in that same commit, so
      // this needn't reset the tick writes.
      pendingCenterYearRef.current = centerYear;
      setPixelsPerYear(targetPixelsPerYear);
    }

    zoomAnimationFrameRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className={styles.wrapper}>
      <ViewportRange startYear={viewportStartYear} endYear={viewportEndYear} />
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
        <button
          type="button"
          onClick={() => zoom(computeZoomIn, 'in')}
          aria-label={m.zoomInAriaLabel()}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoom(computeZoomOut, 'out')}
          aria-label={m.zoomOutAriaLabel()}
        >
          −
        </button>
      </div>
      <div
        ref={scrollRef}
        className={
          isDragging
            ? `${styles.scrollContainer} ${styles.dragging}`
            : styles.scrollContainer
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={zebraLayerRef}
          className={styles.zebraLayer}
          style={{ width: totalWidth }}
        >
          <div className={styles.zebraBand} style={bceZebraStyle} />
          <div className={styles.zebraBand} style={ceZebraStyle} />
        </div>
        <div ref={peopleLaneRef} className={styles.peopleLane}>
          <PeopleLane
            ref={peopleLaneAnimRef}
            people={filteredPeople}
            xScale={scale}
            personRowFor={personRowFor}
            selectedId={
              selectedEntity?.entityType === 'person' ? selectedEntity.id : null
            }
          />
        </div>
        <div className={styles.yearAxis} style={{ width: totalWidth }}>
          <YearAxis
            ref={yearAxisMiddleAnimRef}
            xScale={scale}
            visibleStartYear={visibleStartYear}
            visibleEndYear={visibleEndYear}
          />
        </div>
        <div
          ref={conflictsMilestonesLaneRef}
          className={styles.conflictsMilestonesLane}
        >
          <ConflictsMilestonesLane
            ref={conflictsMilestonesLaneAnimRef}
            conflicts={filteredConflicts}
            milestones={filteredMilestones}
            xScale={scale}
            eventsRowFor={eventsRowFor}
            selectedId={
              selectedEntity?.entityType === 'person'
                ? null
                : (selectedEntity?.id ?? null)
            }
          />
        </div>
      </div>
      {!isMobileViewport &&
        (isMinimapIdle ? (
          <Minimap
            people={filteredPeople}
            conflicts={filteredConflicts}
            milestones={filteredMilestones}
            personRowFor={personRowFor}
            eventsRowFor={eventsRowFor}
            totalWidth={totalWidth}
            viewportWidthPx={viewportWidthPx}
            scrollLeft={scrollLeft}
            onScrollLeftChange={handleScrollLeftChange}
            onScrollLeftJump={handleTrackJump}
          />
        ) : (
          <div className={styles.minimapPlaceholder} aria-hidden="true" />
        ))}
    </div>
  );
}
