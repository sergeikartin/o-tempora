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
  DETAIL_DRAWER_WIDTH_PX,
} from '../../shared/config';
import { centuryBoundaryForYear } from '../../shared/lib/date';
import {
  type ActiveFilters,
  visibleConflicts,
  visibleMilestones,
  visiblePeople,
  type YearSpan,
} from '../../shared/lib/entity';
import {
  motionDurationMs,
  prefersReducedMotion,
} from '../../shared/lib/motion';
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
import { FocusRange } from './FocusRange';
import { selectionFocusYears } from './focus-years';
import { Minimap } from './Minimap';
import {
  computeRowAssignment,
  mapConflicts,
  mapMilestones,
  mapPeople,
} from './map-to-items';
import {
  arrivalFitViewport,
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS,
  buildXScale,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  clampPixelsPerYear,
  zoomIn as computeZoomIn,
  zoomOut as computeZoomOut,
  type DragSample,
  FALLBACK_VIEWPORT_WIDTH_PX,
  INERTIA_MIN_SPEED_PX_PER_MS,
  inertiaStep,
  keyPanStepPx,
  LANE_CAPTION_GUTTER_PX,
  type LabelPinningHandle,
  MIN_YEAR,
  pinchCenterYear,
  pinchPixelsPerYear,
  QUARTER_CENTURY_STEP_YEARS,
  QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS,
  REFERENCE_PIXELS_PER_YEAR,
  releaseVelocityPxPerMs,
  VIEWPORT_BUFFER_RATIO,
  wheelDeltaPx,
  wheelZoomFactor,
  type ZoomAnimationHandle,
  type ZoomAnimationTransform,
  zoomAnimationDurationMs,
  zoomAnimationGroupTransform,
  zoomAnimationGroupTransformCss,
  zoomedViewportYears,
} from './options';
import { PeopleLane } from './PeopleLane';
import { Scrubber, type ScrubberHandle } from './Scrubber';
import styles from './TimelineCanvas.module.css';
import { YearAxis } from './YearAxis';

// Below this much total pointer movement, a mouse-drag counts as a click
// rather than a pan (see suppressNextClickRef).
const DRAG_CLICK_SUPPRESSION_PX = 4;

// A pan gesture fires many native 'scroll' events, so the 'pan' event is
// debounced: it fires this long after the last scroll event in a burst, once
// per gesture (docs/observability.md).
const PAN_TRACK_DEBOUNCE_MS = 500;

// A wheel zoom is a stream of events with no end marker; it settles, and
// commits pixelsPerYear once, this long after the last one.
const WHEEL_ZOOM_SETTLE_MS = 150;

// Keyboard shortcuts defer to anything that uses these keys itself: text
// fields, selects and the Detail Level radio group.
const KEY_OWNING_CONTROL =
  'input, textarea, select, fieldset, [contenteditable], [role="radiogroup"], [role="radio"]';

function isKeyOwningTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(KEY_OWNING_CONTROL) !== null
  );
}

// Buckets a viewport-center year into its century (e.g. "1800s", "3rd
// century BCE") so zoom/pan event data stays low-cardinality.
function periodBucket(year: number): string {
  return centuryBoundaryForYear(Math.round(year)).label;
}

interface TimelineCanvasProps {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  fameScoreValues: FameScoreValues;
  selectedDomains: OccupationDomain[];
  selectedRegions: Region[];
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  onEntityClick: (ref: SelectedEntityRef) => void;
  // Reports post-filter entry counts per lane for the app shell; this widget
  // stays the single owner of the filtering pipeline (docs/code-conventions.md).
  onFilteredCountsChange?: (counts: FilteredCounts) => void;
  selectedEntity?: SelectedEntityRef | null;
  selectedSpan?: YearSpan | null;
  // Set only by a search pick (a canvas click is already in view). App.tsx
  // passes a fresh object each time, so re-picking the same result re-jumps.
  searchJumpTarget?: SelectedEntityRef | null;
  // Set only when an Entity Link opens: fits the viewport to the Selection's
  // span. App.tsx passes a fresh object each time.
  arrivalFit?: ArrivalFit | null;
}

export interface ArrivalFit {
  years: YearSpan;
  entity: SelectedEntityRef;
}

const NO_IDS: readonly string[] = [];

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
  selectedEntity = null,
  selectedSpan = null,
  searchJumpTarget,
  arrivalFit,
}: TimelineCanvasProps) {
  const isMobileViewport = useIsMobileViewport();
  // Defer the Minimap until idle so mobile hydration can switch from the desktop
  // snapshot before mounting a desktop-only control.
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
  const peopleLaneRef = useRef<HTMLElement>(null);
  const conflictsMilestonesLaneRef = useRef<HTMLElement>(null);
  // Per-tick targets for the zoom animation's single rAF driver (zoom()): one
  // group transform per lane/axis, not per-mark recompute (options.ts's
  // ZoomAnimationTransform). zebraLayerRef is rendered here, so a plain ref.
  const peopleLaneAnimRef = useRef<LabelPinningHandle>(null);
  const conflictsMilestonesLaneAnimRef = useRef<LabelPinningHandle>(null);
  const yearAxisMiddleAnimRef = useRef<ZoomAnimationHandle>(null);
  const zebraLayerRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<ScrubberHandle>(null);
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
  // Where the eased jump in flight is heading, so a repeated arrow key chains
  // from the target instead of from wherever the animation is.
  const panAnimationTargetRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (panAnimationFrameRef.current !== null)
        cancelAnimationFrame(panAnimationFrameRef.current);
    },
    [],
  );
  const cancelPanAnimation = useCallback(() => {
    if (panAnimationFrameRef.current !== null) {
      cancelAnimationFrame(panAnimationFrameRef.current);
      panAnimationFrameRef.current = null;
    }
    panAnimationTargetRef.current = null;
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
  const dragSamplesRef = useRef<DragSample[]>([]);
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
  // Use the same density as the prerender so the marks match during hydration.
  const [pixelsPerYear, setPixelsPerYear] = useState(REFERENCE_PIXELS_PER_YEAR);
  // Set by a zoom to the viewport-center year, so the commit effect can
  // re-center on it instead of snapping to the timeline's left edge.
  const pendingCenterYearRef = useRef<number | null>(null);
  // Where that year lands in the viewport on commit: the cursor's offset after a
  // wheel zoom, null (the viewport centre) for every other zoom.
  const pendingAnchorOffsetPxRef = useRef<number | null>(null);
  const pixelsPerYearRef = useRef(pixelsPerYear);
  pixelsPerYearRef.current = pixelsPerYear;
  // In-flight wheel zoom: the frame it started from (marks stay drawn at
  // startPixelsPerYear) and the year pinned under the cursor.
  const wheelZoomRef = useRef<{
    startPixelsPerYear: number;
    currentPixelsPerYear: number;
    anchorYear: number;
    anchorOffsetPx: number;
    scrollLeftStart: number;
    clientWidthPx: number;
    settleTimeout: number;
  } | null>(null);

  const { scale, totalWidth } = useMemo(
    () => buildXScale(pixelsPerYear),
    [pixelsPerYear],
  );
  // While a Selection is open the desktop detail drawer covers the right
  // DETAIL_DRAWER_WIDTH_PX of the canvas, and the timeline ends at the present,
  // so anything recent would sit under it with no way to pan clear. The scroll
  // width grows by that much, as empty space after the present, for as long as
  // the Selection is open. Phones get a bottom sheet over the lanes' lower edge
  // instead, which needs no room to the right.
  const hasSelection = selectedEntity !== null;
  const trailingSlackPx =
    hasSelection && !isMobileViewport ? DETAIL_DRAWER_WIDTH_PX : 0;
  const scrollWidth = totalWidth + trailingSlackPx;
  // A ref, not a dependency of the commit effect below: that effect also
  // re-positions the viewport, which opening a Selection must not do.
  const scrollWidthRef = useRef(scrollWidth);
  scrollWidthRef.current = scrollWidth;
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
  const updateHorizontalFades = useCallback((currentScrollLeft: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const hasMoreLeft = String(currentScrollLeft > 1);
    const hasMoreRight = String(
      currentScrollLeft < scrollWidthRef.current - container.clientWidth - 1,
    );
    for (const lane of [
      peopleLaneRef.current,
      conflictsMilestonesLaneRef.current,
    ]) {
      if (!lane) continue;
      if (lane.dataset.hasMoreLeft !== hasMoreLeft)
        lane.dataset.hasMoreLeft = hasMoreLeft;
      if (lane.dataset.hasMoreRight !== hasMoreRight)
        lane.dataset.hasMoreRight = hasMoreRight;
    }
  }, []);
  // Mirrors scrollRef's scrollLeft onto the sticky lanes. The throttled scroll
  // listener alone lags a frame, which flashes on discrete programmatic jumps
  // (zoom re-centering, mount positioning, Minimap jumps), so every direct
  // scrollLeft write calls this to mirror in the same synchronous step.
  const mirrorLaneScrollLeft = useCallback(
    (newScrollLeft: number) => {
      updateHorizontalFades(newScrollLeft);
      if (peopleLaneRef.current)
        peopleLaneRef.current.scrollLeft = newScrollLeft;
      peopleLaneAnimRef.current?.pinLabelsToViewport(newScrollLeft);
      conflictsMilestonesLaneAnimRef.current?.pinLabelsToViewport(
        newScrollLeft,
      );
      if (conflictsMilestonesLaneRef.current)
        conflictsMilestonesLaneRef.current.scrollLeft = newScrollLeft;
    },
    [updateHorizontalFades],
  );
  // Stable identity (refs only), so effects can depend on it.
  const syncScrollLeft = useCallback(
    (newScrollLeft: number) => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollLeft = newScrollLeft;
      // The browser clamps the write to the pan bounds, but a drag past an edge
      // asks for an out-of-range value; the lanes mirror what actually applied.
      mirrorLaneScrollLeft(container.scrollLeft);
    },
    [mirrorLaneScrollLeft],
  );
  // Skip pan analytics for programmatic positioning and zoom re-centering.
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
  // The scroll range changes without a scroll event when a Selection opens or
  // closes (trailing slack) and when the viewport resizes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollWidth isn't read in the body — it's a trigger to re-derive the right fade when the scroll range changes
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    updateHorizontalFades(container.scrollLeft);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      updateHorizontalFades(container.scrollLeft),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollWidth, updateHorizontalFades]);
  const effectiveViewportWidthPx =
    viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const viewportBufferPx = effectiveViewportWidthPx * VIEWPORT_BUFFER_RATIO;
  const viewportStartYear = scale.invert(scrollLeft);
  // The heading never reads past the present, even over the trailing slack.
  const viewportEndYear = Math.min(
    scale.invert(scrollLeft + effectiveViewportWidthPx),
    scale.domain()[1] ?? Number.POSITIVE_INFINITY,
  );
  const focusYears = selectionFocusYears(selectedSpan);
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
  const filters = useMemo<ActiveFilters>(
    () => ({
      fameScoreValues,
      selectedDomains,
      selectedRegions,
      selectedConflictsMilestonesValues,
    }),
    [
      fameScoreValues,
      selectedDomains,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );
  const filteredPeople = useMemo(
    () => visiblePeople(people, filters),
    [people, filters],
  );
  const filteredConflicts = useMemo(
    () => visibleConflicts(conflicts, filters),
    [conflicts, filters],
  );
  const filteredMilestones = useMemo(
    () => visibleMilestones(milestones, filters),
    [milestones, filters],
  );

  const filteredCounts = useMemo<FilteredCounts>(
    () => ({
      people: filteredPeople.length,
      conflicts: filteredConflicts.length,
      milestones: filteredMilestones.length,
    }),
    [filteredPeople, filteredConflicts, filteredMilestones],
  );

  // Stable per Selection so the memoized lanes only re-scan their marks when
  // the Selection actually changes.
  const selectedPersonIds = useMemo(
    () =>
      selectedEntity?.entityType === 'person' ? [selectedEntity.id] : NO_IDS,
    [selectedEntity],
  );
  const selectedEventIds = useMemo(
    () =>
      selectedEntity && selectedEntity.entityType !== 'person'
        ? [selectedEntity.id]
        : NO_IDS,
    [selectedEntity],
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
  // useLayoutEffect so new counts land in the Top Bar's DOM before paint, with
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
    // Drives .conflictsMilestonesLane's bottom fade (TimelineCanvas.module.css):
    // rows below the visible area. Its svg height follows the visible set, so
    // the observer catches a filter change that the scroll listener can't.
    const updateScrollAffordance = () => {
      el.dataset.hasMoreBelow = String(
        el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      );
    };
    updateScrollAffordance();
    el.addEventListener('scroll', updateScrollAffordance, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateScrollAffordance);
    observer?.observe(el);
    const svg = el.querySelector('svg');
    if (svg) observer?.observe(svg);
    return () => {
      observer?.disconnect();
      el.removeEventListener('scroll', updateScrollAffordance);
    };
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
    const anchorOffsetPx =
      pendingAnchorOffsetPxRef.current ?? clientWidthPx / 2;
    pendingCenterYearRef.current = null;
    pendingAnchorOffsetPxRef.current = null;
    const targetScrollLeft =
      centerYear !== null
        ? scale(centerYear) - anchorOffsetPx
        : scale(DEFAULT_VIEWPORT_START_YEAR);
    const nextScrollLeft = Math.max(
      0,
      Math.min(targetScrollLeft, scrollWidthRef.current - clientWidthPx),
    );
    syncScrollLeft(nextScrollLeft);
    setScrollLeft(nextScrollLeft);
    if (!hasMarkedInitialRenderRef.current) {
      hasMarkedInitialRenderRef.current = true;
      performance.mark('timeline-initial-render');
    }
  }, [scale, syncScrollLeft]);

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
    scrubberRef.current?.setViewport(
      ...zoomedViewportYears(
        start.centerYear,
        currentPixelsPerYear,
        start.clientWidthPx,
      ),
    );
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
    dragSamplesRef.current = [{ timeMs: event.timeStamp, x: event.clientX }];
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
    dragSamplesRef.current.push({ timeMs: event.timeStamp, x: event.clientX });
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
    if (drag.moved) suppressNextClickRef.current = true;
    try {
      scrollRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handlePointerDown's comment
    }
    setIsDragging(false);
    if (drag.moved && event.type === 'pointerup') {
      startInertia(
        -releaseVelocityPxPerMs(dragSamplesRef.current, event.timeStamp),
      );
    }
    dragSamplesRef.current = [];
  }

  // Keeps a released drag coasting, decaying to a stop or to the pan bounds,
  // whichever comes first. Skipped under prefers-reduced-motion. The scroll
  // velocity is in px/ms, positive toward later years.
  function startInertia(initialVelocityPxPerMs: number) {
    const container = scrollRef.current;
    if (!container || prefersReducedMotion()) return;
    if (Math.abs(initialVelocityPxPerMs) < INERTIA_MIN_SPEED_PX_PER_MS) return;
    cancelPanAnimation();
    let velocityPxPerMs = initialVelocityPxPerMs;
    let position = container.scrollLeft;
    let previousTimeMs: number | null = null;

    function tick(nowMs: number) {
      const el = scrollRef.current;
      if (!el) return;
      const dtMs = previousTimeMs === null ? 0 : nowMs - previousTimeMs;
      previousTimeMs = nowMs;
      const step = inertiaStep(velocityPxPerMs, dtMs);
      const maxScrollLeft = Math.max(
        scrollWidthRef.current - el.clientWidth,
        0,
      );
      position = Math.min(
        Math.max(position + step.distancePx, 0),
        maxScrollLeft,
      );
      velocityPxPerMs = step.velocityPxPerMs;
      syncScrollLeft(position);
      const hitBound = position === 0 || position === maxScrollLeft;
      if (hitBound || Math.abs(velocityPxPerMs) < INERTIA_MIN_SPEED_PX_PER_MS) {
        panAnimationFrameRef.current = null;
        return;
      }
      panAnimationFrameRef.current = requestAnimationFrame(tick);
    }

    panAnimationFrameRef.current = requestAnimationFrame(tick);
  }

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
    panAnimationTargetRef.current = targetScrollLeft;
    const startScrollLeft = container.scrollLeft;
    const durationMs = motionDurationMs('--motion-duration-base');
    if (durationMs <= 0) {
      panAnimationTargetRef.current = null;
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
      panAnimationTargetRef.current = null;
    }

    panAnimationFrameRef.current = requestAnimationFrame(tick);
  }

  function scrollLeftForCenterYear(centerYear: number): number | null {
    const container = scrollRef.current;
    if (!container) return null;
    const maxScrollLeft = Math.max(
      scrollWidthRef.current - container.clientWidth,
      0,
    );
    return Math.min(
      Math.max(scale(centerYear) - container.clientWidth / 2, 0),
      maxScrollLeft,
    );
  }

  function handleScrubberCenterYearChange(centerYear: number) {
    const target = scrollLeftForCenterYear(centerYear);
    if (target !== null) handleScrollLeftChange(target);
  }

  function handleScrubberCenterYearJump(centerYear: number) {
    const target = scrollLeftForCenterYear(centerYear);
    if (target !== null) handleTrackJump(target);
  }

  // Each lane also scrolls vertically on its own, so a mark away from the
  // fame-priority default position can land outside the viewport. Rather than
  // duplicate each lane's row layout math, find the rendered mark by the
  // data-entity-id attribute the click listener reads and scroll it to the
  // lane's vertical center from its real geometry.
  function scrollMarkToLaneCenter(ref: SelectedEntityRef) {
    const laneEl =
      ref.entityType === 'person'
        ? peopleLaneRef.current
        : conflictsMilestonesLaneRef.current;
    const mark = laneEl?.querySelector(`[data-entity-id="${ref.id}"]`);
    if (!laneEl || !mark) return;
    const laneRect = laneEl.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const markTopWithinLane = markRect.top - laneRect.top + laneEl.scrollTop;
    laneEl.scrollTop =
      markTopWithinLane - laneEl.clientHeight / 2 + markRect.height / 2;
  }

  // A search pick pans to center the entity (no zoom-to-fit), reusing the
  // eased scroll above, on the midpoint of its start/end (the map* functions
  // already resolve the "still alive"/zero-width cases as the lanes render
  // them).
  //
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

    scrollMarkToLaneCenter(searchJumpTarget);
  }, [searchJumpTarget]);

  // An Entity Link fits the viewport to the entity's span, measured
  // against the part of the canvas the desktop detail drawer leaves uncovered
  // (the phone sheet only covers the bottom, so the full width is free). A zoom
  // change commits through the pixelsPerYear layout effect, which re-centers on
  // pendingCenterYearRef; an unchanged zoom just pans.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only arrivalFit should retrigger a fit — see searchJumpTarget's note above
  useEffect(() => {
    if (!arrivalFit) return;
    const container = scrollRef.current;
    if (!container) return;
    const canvasWidthPx = container.clientWidth || FALLBACK_VIEWPORT_WIDTH_PX;
    const drawerWidthPx = isMobileViewport ? 0 : DETAIL_DRAWER_WIDTH_PX;
    const fit = arrivalFitViewport(
      arrivalFit.years,
      canvasWidthPx,
      drawerWidthPx,
    );
    if (fit.pixelsPerYear === pixelsPerYear) {
      handleTrackJump(scale(fit.centerYear) - canvasWidthPx / 2);
    } else {
      cancelPanAnimation();
      pendingCenterYearRef.current = fit.centerYear;
      setPixelsPerYear(fit.pixelsPerYear);
    }
    scrollMarkToLaneCenter(arrivalFit.entity);
  }, [arrivalFit]);

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
      // Pointer capture retargets the click to the scroll container. Hit-test the
      // release coordinates to recover the underlying mark.
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

  // Transform the drawn marks during zoom. Recomputing their layout each frame
  // exceeds the frame budget.
  function zoom(
    step: (currentPixelsPerYear: number, viewportWidthPx: number) => number,
    direction: 'in' | 'out',
    method: 'button' | 'key' = 'button',
  ) {
    const container = scrollRef.current;
    if (!container) {
      setPixelsPerYear((current) => step(current, 0));
      return;
    }
    cancelPanAnimation();
    abandonWheelZoom();
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
      method,
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
      scrubberRef.current?.setViewport(
        ...zoomedViewportYears(centerYear, currentPixelsPerYear, clientWidthPx),
      );
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

  function abandonWheelZoom() {
    const gesture = wheelZoomRef.current;
    if (!gesture) return;
    window.clearTimeout(gesture.settleTimeout);
    wheelZoomRef.current = null;
  }

  // The wheel-zoom gesture ended: commit pixelsPerYear once, anchored so the
  // year under the cursor stays under it (pending refs → the commit layout
  // effect). A zoom that ended where it began only has the transform to undo.
  function settleWheelZoom() {
    const gesture = wheelZoomRef.current;
    wheelZoomRef.current = null;
    if (!gesture) return;
    if (gesture.currentPixelsPerYear === gesture.startPixelsPerYear) {
      applyZoomAnimationTick({ tx: 0, sx: 1 });
      return;
    }
    pendingCenterYearRef.current = gesture.anchorYear;
    pendingAnchorOffsetPxRef.current = gesture.anchorOffsetPx;
    setPixelsPerYear(gesture.currentPixelsPerYear);
    trackEvent('zoom', {
      method: 'wheel',
      direction:
        gesture.currentPixelsPerYear > gesture.startPixelsPerYear
          ? 'in'
          : 'out',
      period: periodBucket(gesture.anchorYear),
    });
  }

  // Ctrl/Cmd+wheel and trackpad pinch (which browsers report as ctrl+wheel).
  // Same transform path as button zoom and touch pinch: marks stay drawn at the
  // starting pixelsPerYear while one group transform tracks the live value.
  function handleWheelZoom(event: WheelEvent, container: HTMLDivElement) {
    if (
      zoomAnimationFrameRef.current !== null ||
      pinchStartRef.current ||
      dragStartRef.current
    )
      return;
    const clientWidthPx = container.clientWidth;
    const factor = wheelZoomFactor(
      wheelDeltaPx(event.deltaY, event.deltaMode, clientWidthPx),
    );
    let gesture = wheelZoomRef.current;
    const currentPixelsPerYear = clampPixelsPerYear(
      (gesture?.currentPixelsPerYear ?? pixelsPerYearRef.current) * factor,
      clientWidthPx,
    );
    if (!gesture) {
      if (currentPixelsPerYear === pixelsPerYearRef.current) return;
      cancelPanAnimation();
      beginZoomAnimation();
      const anchorOffsetPx =
        event.clientX - container.getBoundingClientRect().left;
      const scrollLeftStart = container.scrollLeft;
      gesture = {
        startPixelsPerYear: pixelsPerYearRef.current,
        currentPixelsPerYear,
        anchorYear: scaleRef.current.invert(scrollLeftStart + anchorOffsetPx),
        anchorOffsetPx,
        scrollLeftStart,
        clientWidthPx,
        settleTimeout: 0,
      };
      wheelZoomRef.current = gesture;
    }
    gesture.currentPixelsPerYear = currentPixelsPerYear;
    window.clearTimeout(gesture.settleTimeout);
    gesture.settleTimeout = window.setTimeout(
      settleWheelZoom,
      WHEEL_ZOOM_SETTLE_MS,
    );
    scrubberRef.current?.setViewport(
      ...zoomedViewportYears(
        gesture.anchorYear,
        currentPixelsPerYear,
        clientWidthPx,
        gesture.anchorOffsetPx,
      ),
    );
    applyZoomAnimationTick(
      zoomAnimationGroupTransform({
        startPixelsPerYear: gesture.startPixelsPerYear,
        currentPixelsPerYear,
        minYear: MIN_YEAR,
        centerYear: gesture.anchorYear,
        scrollLeftStart: gesture.scrollLeftStart,
        clientWidthPx,
        anchorOffsetPx: gesture.anchorOffsetPx,
      }),
    );
  }

  // Wheel input over the timeline. Ctrl/Cmd zooms under the cursor (and keeps
  // the browser from zooming the page). Shift+wheel pans. A plain wheel is left
  // alone so the lane under the cursor scrolls its rows, and so is a native
  // horizontal wheel/trackpad swipe, which already scrolls this container with
  // the platform's own momentum.
  function handleWheel(event: WheelEvent) {
    const container = scrollRef.current;
    if (!container) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleWheelZoom(event, container);
      return;
    }
    if (!event.shiftKey) return;
    event.preventDefault();
    if (wheelZoomRef.current) return;
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    cancelPanAnimation();
    panBy(wheelDeltaPx(delta, event.deltaMode, container.clientWidth));
  }

  function clampedScrollLeft(target: number): number {
    const container = scrollRef.current;
    const maxScrollLeft = Math.max(
      scrollWidthRef.current - (container?.clientWidth ?? 0),
      0,
    );
    return Math.min(Math.max(target, 0), maxScrollLeft);
  }

  function panBy(deltaPx: number) {
    const container = scrollRef.current;
    if (container)
      syncScrollLeft(clampedScrollLeft(container.scrollLeft + deltaPx));
  }

  // ←/→ pan by a tenth of the viewport (half with Shift), eased like a track
  // jump; a held key moves directly so the repeats don't restart the easing.
  // +/-/= zoom about the viewport centre, as the buttons do.
  function handleKeyDown(event: KeyboardEvent) {
    const container = scrollRef.current;
    if (!container || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isKeyOwningTarget(event.target)) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const stepPx =
        direction * keyPanStepPx(container.clientWidth, event.shiftKey);
      const target = clampedScrollLeft(
        (panAnimationTargetRef.current ?? container.scrollLeft) + stepPx,
      );
      if (event.repeat) {
        cancelPanAnimation();
        syncScrollLeft(target);
      } else {
        handleTrackJump(target);
      }
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(computeZoomIn, 'in', 'key');
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoom(computeZoomOut, 'out', 'key');
    }
  }

  // Stable listeners that call the latest handlers, which close over this
  // render's state. wheel must be a native non-passive listener: React's
  // onWheel is passive, so it could not prevent the page zoom.
  const navigationHandlersRef = useRef({
    wheel: handleWheel,
    keyDown: handleKeyDown,
  });
  navigationHandlersRef.current = {
    wheel: handleWheel,
    keyDown: handleKeyDown,
  };
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) =>
      navigationHandlersRef.current.wheel(event);
    const onKeyDown = (event: KeyboardEvent) =>
      navigationHandlersRef.current.keyDown(event);
    container.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKeyDown);
      const gesture = wheelZoomRef.current;
      if (gesture) window.clearTimeout(gesture.settleTimeout);
    };
  }, []);

  return (
    <div
      className={styles.wrapper}
      style={
        {
          '--lane-caption-gutter': `${LANE_CAPTION_GUTTER_PX}px`,
          '--detail-drawer-width': `${DETAIL_DRAWER_WIDTH_PX}px`,
        } as CSSProperties
      }
    >
      <FocusRange
        startApproximate={focusYears?.startApproximate}
        endApproximate={focusYears?.endApproximate}
        startYear={focusYears?.startYear ?? viewportStartYear}
        endYear={focusYears?.endYear ?? viewportEndYear}
      />
      {/* The slot is in the prerender too and hidden by CSS above the mobile
          breakpoint, so the Scrubber's mount (after hydration, which assumes
          desktop) doesn't shift the layout. */}
      <div className={styles.scrubberSlot}>
        {isMobileViewport && (
          <Scrubber
            ref={scrubberRef}
            viewportStartYear={viewportStartYear}
            viewportEndYear={viewportEndYear}
            onCenterYearChange={handleScrubberCenterYearChange}
            onCenterYearJump={handleScrubberCenterYearJump}
          />
        )}
      </div>
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
        <section
          ref={peopleLaneRef}
          className={styles.peopleLane}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable so its rows can be scrolled without a pointer
          tabIndex={0}
          aria-label={m.peopleHeading()}
        >
          <div className={styles.laneCaption} aria-hidden="true">
            <span className={styles.laneCaptionText}>{m.peopleHeading()}</span>
          </div>
          <PeopleLane
            ref={peopleLaneAnimRef}
            people={filteredPeople}
            xScale={scale}
            personRowFor={personRowFor}
            selectedIds={selectedPersonIds}
          />
          <div
            className={styles.trailingSlack}
            style={{ width: scrollWidth }}
            aria-hidden="true"
          />
        </section>
        <div className={styles.yearAxis} style={{ width: scrollWidth }}>
          <YearAxis
            ref={yearAxisMiddleAnimRef}
            xScale={scale}
            visibleStartYear={visibleStartYear}
            visibleEndYear={visibleEndYear}
          />
        </div>
        <section
          ref={conflictsMilestonesLaneRef}
          className={styles.conflictsMilestonesLane}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable so its rows can be scrolled without a pointer
          tabIndex={0}
          aria-label={m.conflictsMilestonesHeading()}
        >
          <div className={styles.laneCaption} aria-hidden="true">
            <span className={styles.laneCaptionText}>
              {m.conflictsMilestonesHeading()}
            </span>
          </div>
          <ConflictsMilestonesLane
            ref={conflictsMilestonesLaneAnimRef}
            conflicts={filteredConflicts}
            milestones={filteredMilestones}
            xScale={scale}
            eventsRowFor={eventsRowFor}
            selectedIds={selectedEventIds}
          />
          <div
            className={styles.trailingSlack}
            style={{ width: scrollWidth }}
            aria-hidden="true"
          />
        </section>
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
