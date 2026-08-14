import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as d3 from 'd3';
import type { ConflictEntry, Milestone, Person } from '../../shared/types';
import { formatYear } from '../../shared/lib/format-year';
import { STRINGS } from '../../shared/i18n';
import { computeDensityProfile, logScaleHeightPx } from './mountain-profile';
import { defaultPixelsPerYear, FALLBACK_VIEWPORT_WIDTH_PX } from './options';
import styles from './MountainProfile.module.css';

// Enforced via CSS min-width on .viewportRect, kept here too since the drag
// math below needs the same floor to convert a rect pointer-move into a
// scrollLeft delta — mirrors the old scrollbar thumb's own
// MIN_SCROLLBAR_THUMB_PX (ADR 0004).
const MIN_VIEWPORT_RECT_PX = 24;

// SVG viewBox coordinate space for the ridge — arbitrary units, scaled to
// the track's real rendered size by preserveAspectRatio="none" below, so
// resizing the track never requires recomputing the path data.
const RIDGE_VIEWBOX_HEIGHT = 100;
const RIDGE_BASELINE = RIDGE_VIEWBOX_HEIGHT / 2;

interface MountainProfileProps {
  // Already fame-filtered by the caller (TimelineCanvas) — the profile
  // recomputes on every fame-score change with no debounce, so it always
  // reflects the currently visible entity set (ADR 0004).
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // The live (current-zoom) scroll geometry, same values TimelineCanvas
  // already tracks for the lanes/Year Axis — used only for the draggable
  // viewport-rectangle overlay's ratio math, never for the Row Depth
  // computation itself (that uses its own fixed Reference Scale).
  totalWidth: number;
  viewportWidthPx: number;
  scrollLeft: number;
  onScrollLeftChange: (scrollLeft: number) => void;
}

interface HoverInfo {
  xRatio: number;
  year: number;
  peopleDepth: number;
  eventsDepth: number;
}

// Replaces the custom scrollbar (ADR 0004): an SVG area-sparkline spanning
// the full pannable range, People's Row Depth mirrored above a center
// baseline against the merged Conflicts+Milestones' Row Depth below it.
// Keeps the scrollbar's own interaction model — a press anywhere on the
// track jumps the viewport there, dragging the overlaid translucent
// .viewportRect pans — and adds a hover tooltip with exact date/Row-Depth
// numbers, recovering the precision the log scale deliberately compresses
// away.
export function MountainProfile({
  people,
  conflicts,
  milestones,
  totalWidth,
  viewportWidthPx,
  scrollLeft,
  onScrollLeftChange,
}: MountainProfileProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rectDragRef = useRef<{ pointerX: number; startScrollLeft: number; trackWidthPx: number } | null>(null);
  const [isRectDragging, setIsRectDragging] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Recomputed only when the viewport is resized, not on every zoom/pan —
  // this fixed Reference Scale (rather than the caller's live
  // pixelsPerYear) is what keeps the profile's shape stable while the user
  // navigates (ADR 0004).
  const referencePixelsPerYear = useMemo(() => defaultPixelsPerYear(viewportWidthPx), [viewportWidthPx]);

  const profile = useMemo(
    () => computeDensityProfile(people, conflicts, milestones, referencePixelsPerYear),
    [people, conflicts, milestones, referencePixelsPerYear],
  );
  const bucketCount = profile.years.length;
  const maxPeopleDepth = Math.max(1, ...profile.peopleDepth);
  const maxEventsDepth = Math.max(1, ...profile.eventsDepth);

  const { peoplePath, eventsPath } = useMemo(() => {
    const peopleArea = d3
      .area<number>()
      .x((_depth, i) => i)
      .y0(RIDGE_BASELINE)
      .y1((depth) => RIDGE_BASELINE - logScaleHeightPx(depth, maxPeopleDepth, RIDGE_BASELINE))
      .curve(d3.curveMonotoneX);
    const eventsArea = d3
      .area<number>()
      .x((_depth, i) => i)
      .y0(RIDGE_BASELINE)
      .y1((depth) => RIDGE_BASELINE + logScaleHeightPx(depth, maxEventsDepth, RIDGE_BASELINE))
      .curve(d3.curveMonotoneX);
    return {
      peoplePath: peopleArea(profile.peopleDepth) ?? '',
      eventsPath: eventsArea(profile.eventsDepth) ?? '',
    };
  }, [profile, maxPeopleDepth, maxEventsDepth]);

  // Same ratio-based geometry the scrollbar thumb this replaces used
  // (TimelineCanvas.tsx) — tracks the track element's real rendered width
  // for free rather than reading it during render, which isn't available
  // before layout.
  const effectiveViewportWidthPx = viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const rectWidthRatio = totalWidth > 0 ? Math.min(effectiveViewportWidthPx / totalWidth, 1) : 1;
  const maxScrollLeftForRect = Math.max(totalWidth - effectiveViewportWidthPx, 0);
  const rectLeftRatio = maxScrollLeftForRect > 0 ? (scrollLeft / maxScrollLeftForRect) * (1 - rectWidthRatio) : 0;

  function bucketIndexForRatio(ratio: number): number {
    return Math.min(bucketCount - 1, Math.max(0, Math.round(ratio * (bucketCount - 1))));
  }

  function handleRectPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    // Stops this press from also reaching the track's own click-to-jump
    // handler below (React events bubble like native ones) — a press that
    // starts on the rect should drag it, not also jump-to-position.
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    rectDragRef.current = { pointerX: event.clientX, startScrollLeft: scrollLeft, trackWidthPx: track.clientWidth };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // no-op — pointer capture can throw for an already-inactive pointerId
    }
    setIsRectDragging(true);
  }

  function handleRectPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = rectDragRef.current;
    if (!drag) return;
    const maxScrollLeft = Math.max(totalWidth - drag.trackWidthPx, 0);
    if (maxScrollLeft <= 0) return;
    // Same MIN_VIEWPORT_RECT_PX floor as the rect's own CSS min-width —
    // needed here so a dragged pixel maps to the same scrollLeft distance
    // the rendered (possibly floor-clamped) rect width implies.
    const rectWidthPx = Math.max(MIN_VIEWPORT_RECT_PX, (drag.trackWidthPx / totalWidth) * drag.trackWidthPx);
    const maxRectOffsetPx = Math.max(drag.trackWidthPx - rectWidthPx, 1);
    const deltaPx = event.clientX - drag.pointerX;
    const scrollLeftPerRectPx = maxScrollLeft / maxRectOffsetPx;
    onScrollLeftChange(Math.min(Math.max(drag.startScrollLeft + deltaPx * scrollLeftPerRectPx, 0), maxScrollLeft));
  }

  function endRectDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!rectDragRef.current) return;
    rectDragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handleRectPointerDown's comment
    }
    setIsRectDragging(false);
  }

  // A press anywhere else on the track jumps the viewport to center on that
  // point — the rect drag above stops its own press from ever bubbling
  // here.
  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const maxScrollLeft = Math.max(totalWidth - track.clientWidth, 0);
    onScrollLeftChange(Math.min(Math.max(clickRatio * totalWidth - track.clientWidth / 2, 0), maxScrollLeft));
  }

  // Recovers the precision the log scale deliberately compresses away —
  // exact date and Row Depth numbers per series at the cursor's position.
  function handleTrackPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const bucketIndex = bucketIndexForRatio(xRatio);
    setHover({
      xRatio,
      year: profile.years[bucketIndex] ?? 0,
      peopleDepth: profile.peopleDepth[bucketIndex] ?? 0,
      eventsDepth: profile.eventsDepth[bucketIndex] ?? 0,
    });
  }

  function handleTrackPointerLeave() {
    setHover(null);
  }

  return (
    <div
      ref={trackRef}
      className={styles.track}
      data-testid="mountain-profile-track"
      aria-label={STRINGS.minimapAriaLabel}
      onPointerDown={handleTrackPointerDown}
      onPointerMove={handleTrackPointerMove}
      onPointerLeave={handleTrackPointerLeave}
    >
      <svg
        className={styles.ridge}
        data-testid="mountain-profile-ridge"
        viewBox={`0 0 ${bucketCount - 1} ${RIDGE_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line className={styles.baseline} x1={0} x2={bucketCount - 1} y1={RIDGE_BASELINE} y2={RIDGE_BASELINE} />
        <path className={styles.peopleArea} data-testid="mountain-profile-people-area" d={peoplePath} />
        <path className={styles.eventsArea} data-testid="mountain-profile-events-area" d={eventsPath} />
      </svg>
      <div
        className={isRectDragging ? `${styles.viewportRect} ${styles.dragging}` : styles.viewportRect}
        data-testid="mountain-profile-viewport-rect"
        style={{ width: `${rectWidthRatio * 100}%`, left: `${rectLeftRatio * 100}%` }}
        onPointerDown={handleRectPointerDown}
        onPointerMove={handleRectPointerMove}
        onPointerUp={endRectDrag}
        onPointerCancel={endRectDrag}
      />
      {hover && (
        <div
          className={styles.tooltip}
          data-testid="mountain-profile-tooltip"
          style={{ left: `${hover.xRatio * 100}%` }}
          role="tooltip"
        >
          <div className={styles.tooltipDate}>{formatYear(Math.round(hover.year))}</div>
          <div className={styles.tooltipRow}>People: {hover.peopleDepth} rows</div>
          <div className={styles.tooltipRow}>Conflicts+Milestones: {hover.eventsDepth} rows</div>
        </div>
      )}
    </div>
  );
}
