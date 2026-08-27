import * as d3 from 'd3';
import {
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatYear } from '../../shared/lib/date';
import { m } from '../../shared/paraglide/messages.js';
import type { ConflictEntry, Milestone, Person } from '../../shared/types';
import styles from './Minimap.module.css';
import {
  centuryTicksInRange,
  computeDensityProfile,
  logScaleHeightPx,
} from './minimap';
import {
  buildXScale,
  FALLBACK_VIEWPORT_WIDTH_PX,
  MIN_YEAR,
  REFERENCE_PIXELS_PER_YEAR,
} from './options';

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

// Rough per-character estimate for the century strip's 9px label font (see
// options.ts's own AVG_CHAR_WIDTH_PX, tuned for the lanes' 11px labels) plus
// a little breathing room before the next tick's own label — good enough to
// bound label width for the centuryTicks thinning pass below without a real
// DOM text-measurement.
const CENTURY_LABEL_CHAR_WIDTH_PX = 5;
const CENTURY_LABEL_GAP_PX = 6;

function estimateCenturyLabelWidthPx(label: string): number {
  return label.length * CENTURY_LABEL_CHAR_WIDTH_PX + CENTURY_LABEL_GAP_PX;
}

interface MinimapProps {
  // Already fame-filtered by the caller (TimelineCanvas) — the profile
  // recomputes on every fame-score change with no debounce, so it always
  // reflects the currently visible entity set (ADR 0004).
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // Resolves an id set to its Row Depth — the same resolvers
  // PeopleLane/ConflictsMilestonesLane render with (map-to-items.ts's
  // computeRowAssignment). The Row Depth profile below calls these with the
  // currently-filtered people/conflicts/milestones ids, exactly like each
  // lane does, so the depth reported here always matches what's actually
  // stacked on canvas.
  personRowFor: (ids: string[]) => Map<string, number>;
  eventsRowFor: (ids: string[]) => Map<string, number>;
  // The live (current-zoom) scroll geometry, same values TimelineCanvas
  // already tracks for the lanes/Year Axis — used only for the draggable
  // viewport-rectangle overlay's ratio math, never for the Row Depth
  // computation itself (that uses its own fixed Reference Scale).
  totalWidth: number;
  viewportWidthPx: number;
  scrollLeft: number;
  // Fired continuously while the viewport rect is being dragged — must stay
  // 1:1 with the pointer (see handleRectPointerMove), so the caller applies
  // it instantly, no animation.
  onScrollLeftChange: (scrollLeft: number) => void;
  // Fired once for a track click-to-jump — a discrete target the caller is
  // free to (and does) glide the lanes toward, since there's no pointer to
  // lag behind.
  onScrollLeftJump: (scrollLeft: number) => void;
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
// away. A thin, non-interactive strip of century tick marks runs along the
// top edge (`/grill-with-docs`), purely decorative — it never intercepts
// the track/rect's own click-to-jump, drag, or hover handling.
export function Minimap({
  people,
  conflicts,
  milestones,
  personRowFor,
  eventsRowFor,
  totalWidth,
  viewportWidthPx,
  scrollLeft,
  onScrollLeftChange,
  onScrollLeftJump,
}: MinimapProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rectDragRef = useRef<{
    pointerX: number;
    startScrollLeft: number;
    trackWidthPx: number;
  } | null>(null);
  const [isRectDragging, setIsRectDragging] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  // TimelineCanvas only re-measures viewportWidthPx on mount and on a
  // zoom-button click (see its own useLayoutEffect) — a plain window resize
  // never touches it, so it can go stale while .track itself (CSS flex)
  // resizes live. The viewport-rect ratio math below tolerates that (it's
  // re-derived from totalWidth on every render anyway), but the
  // century-tick label thinning below doesn't: a stale, too-wide value
  // would keep labels the real (narrower) strip no longer has room for.
  // ResizeObserver keeps this one in sync with .track's actual box.
  const [measuredTrackWidthPx, setMeasuredTrackWidthPx] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setMeasuredTrackWidthPx(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Same ratio-based geometry the scrollbar thumb this replaces used
  // (TimelineCanvas.tsx). Computed up front since both the viewport-rect
  // ratio math below and the century-tick label spacing further down need
  // it.
  const effectiveViewportWidthPx =
    viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const effectiveTrackWidthPx =
    measuredTrackWidthPx || effectiveViewportWidthPx;

  // The same fixed Reference Scale computeRowAssignment's static row
  // assignment uses (map-to-items.ts) — not the live measured viewport
  // width, which would pack rows differently (row-gap/label widths are
  // fixed pixel quantities, so a different pixels-per-year changes how many
  // overlap) and make the Row Depth shown here disagree with what the
  // canvas actually renders (ADR 0004).
  const profile = useMemo(
    () =>
      computeDensityProfile(
        people,
        conflicts,
        milestones,
        REFERENCE_PIXELS_PER_YEAR,
        personRowFor,
        eventsRowFor,
      ),
    [people, conflicts, milestones, personRowFor, eventsRowFor],
  );
  const bucketCount = profile.years.length;
  const maxPeopleDepth = Math.max(1, ...profile.peopleDepth);
  const maxEventsDepth = Math.max(1, ...profile.eventsDepth);

  // Top-edge century-tick strip (`/grill-with-docs`) — ticks at every
  // century boundary across the same full pannable domain the ridge itself
  // spans (reuses the same REFERENCE_PIXELS_PER_YEAR-built scale, so a tick's
  // x position always lines up with the density shape beneath it). Labels
  // use the plain "1500"/"100 BCE" numeric style (formatYear, same as
  // YearAxis's own labels and the hover tooltip below) rather than
  // centuryBoundaryForYear's ordinal "1500s"/"15th century BCE" phrasing —
  // shorter, and consistent with the rest of the app's date formatting.
  // Labels thin out by walking left to right and only keeping one that
  // clears the *previous shown label's own rendered width* (not a flat gap
  // like YearAxis's MIN_DECADE_LABEL_SPACING_PX toggle) — even this shorter
  // style varies enough in length ("1800" vs. "800 BCE") that a uniform
  // threshold would still let a long label visually overlap the next tick's
  // short one.
  const centuryTicks = useMemo(() => {
    const { scale: refScale, totalWidth: refTotalWidthPx } = buildXScale(
      REFERENCE_PIXELS_PER_YEAR,
    );
    if (refTotalWidthPx <= 0) return [];
    const [, domainMaxYear] = refScale.domain();
    let lastLabelRightEdgePx = -Infinity;
    return centuryTicksInRange(MIN_YEAR, domainMaxYear ?? MIN_YEAR).map(
      (boundary) => {
        const label = formatYear(boundary.startYear);
        const leftPercent =
          (refScale(boundary.startYear) / refTotalWidthPx) * 100;
        const xPx = (leftPercent / 100) * effectiveTrackWidthPx;
        // Labels are centered under their tick (CSS translateX(-50%)), so the
        // collision check is against each label's own left/right half-width,
        // not its raw x position.
        const halfWidthPx = estimateCenturyLabelWidthPx(label) / 2;
        const showLabel = xPx - halfWidthPx >= lastLabelRightEdgePx;
        if (showLabel) lastLabelRightEdgePx = xPx + halfWidthPx;
        return { startYear: boundary.startYear, label, leftPercent, showLabel };
      },
    );
  }, [effectiveTrackWidthPx]);

  const { peoplePath, eventsPath } = useMemo(() => {
    const peopleArea = d3
      .area<number>()
      .x((_depth, i) => i)
      .y0(RIDGE_BASELINE)
      .y1(
        (depth) =>
          RIDGE_BASELINE -
          logScaleHeightPx(depth, maxPeopleDepth, RIDGE_BASELINE),
      )
      .curve(d3.curveMonotoneX);
    const eventsArea = d3
      .area<number>()
      .x((_depth, i) => i)
      .y0(RIDGE_BASELINE)
      .y1(
        (depth) =>
          RIDGE_BASELINE +
          logScaleHeightPx(depth, maxEventsDepth, RIDGE_BASELINE),
      )
      .curve(d3.curveMonotoneX);
    return {
      peoplePath: peopleArea(profile.peopleDepth) ?? '',
      eventsPath: eventsArea(profile.eventsDepth) ?? '',
    };
  }, [profile, maxPeopleDepth, maxEventsDepth]);

  // Same ratio-based geometry the scrollbar thumb this replaces used
  // (TimelineCanvas.tsx) — effectiveViewportWidthPx itself is computed above,
  // shared with the century-tick label spacing.
  const rectWidthRatio =
    totalWidth > 0 ? Math.min(effectiveViewportWidthPx / totalWidth, 1) : 1;
  const maxScrollLeftForRect = Math.max(
    totalWidth - effectiveViewportWidthPx,
    0,
  );
  const rectLeftRatio =
    maxScrollLeftForRect > 0
      ? (scrollLeft / maxScrollLeftForRect) * (1 - rectWidthRatio)
      : 0;

  function bucketIndexForRatio(ratio: number): number {
    return Math.min(
      bucketCount - 1,
      Math.max(0, Math.round(ratio * (bucketCount - 1))),
    );
  }

  function handleRectPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    // Stops this press from also reaching the track's own click-to-jump
    // handler below (React events bubble like native ones) — a press that
    // starts on the rect should drag it, not also jump-to-position.
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    rectDragRef.current = {
      pointerX: event.clientX,
      startScrollLeft: scrollLeft,
      trackWidthPx: track.clientWidth,
    };
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
    const rectWidthPx = Math.max(
      MIN_VIEWPORT_RECT_PX,
      (drag.trackWidthPx / totalWidth) * drag.trackWidthPx,
    );
    const maxRectOffsetPx = Math.max(drag.trackWidthPx - rectWidthPx, 1);
    const deltaPx = event.clientX - drag.pointerX;
    const scrollLeftPerRectPx = maxScrollLeft / maxRectOffsetPx;
    onScrollLeftChange(
      Math.min(
        Math.max(drag.startScrollLeft + deltaPx * scrollLeftPerRectPx, 0),
        maxScrollLeft,
      ),
    );
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
    const clickRatio =
      rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const maxScrollLeft = Math.max(totalWidth - track.clientWidth, 0);
    onScrollLeftJump(
      Math.min(
        Math.max(clickRatio * totalWidth - track.clientWidth / 2, 0),
        maxScrollLeft,
      ),
    );
  }

  // Recovers the precision the log scale deliberately compresses away —
  // exact date and Row Depth numbers per series at the cursor's position.
  function handleTrackPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const xRatio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
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
    <div className={styles.wrapper}>
      <div
        className={styles.centuryStrip}
        data-testid="minimap-century-strip"
        aria-hidden="true"
      >
        {centuryTicks.map((tick) => (
          <div
            key={tick.startYear}
            className={styles.centuryTick}
            style={{ left: `${tick.leftPercent}%` }}
          >
            {tick.showLabel && (
              <span className={styles.centuryLabel}>{tick.label}</span>
            )}
          </div>
        ))}
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        data-testid="minimap-track"
        // role="img": the implicit "generic" role a bare div otherwise gets
        // doesn't support an accessible name — an aria-label on it is
        // invalid ARIA usage — and img is the closest fit for a density
        // graphic. The click/drag-to-jump interaction itself stays
        // mouse/touch-only, same as every other mark in the canvas.
        role="img"
        aria-label={m.minimapAriaLabel()}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerLeave={handleTrackPointerLeave}
      >
        <svg
          className={styles.ridge}
          data-testid="minimap-ridge"
          viewBox={`0 0 ${bucketCount - 1} ${RIDGE_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            className={styles.baseline}
            x1={0}
            x2={bucketCount - 1}
            y1={RIDGE_BASELINE}
            y2={RIDGE_BASELINE}
          />
          <path
            className={styles.peopleArea}
            data-testid="minimap-people-area"
            d={peoplePath}
          />
          <path
            className={styles.eventsArea}
            data-testid="minimap-events-area"
            d={eventsPath}
          />
        </svg>
      </div>
      <div
        className={
          isRectDragging
            ? `${styles.viewportRect} ${styles.dragging}`
            : styles.viewportRect
        }
        data-testid="minimap-viewport-rect"
        style={{
          width: `${rectWidthRatio * 100}%`,
          left: `${rectLeftRatio * 100}%`,
        }}
        onPointerDown={handleRectPointerDown}
        onPointerMove={handleRectPointerMove}
        onPointerUp={endRectDrag}
        onPointerCancel={endRectDrag}
      />
      {hover && (
        <div
          className={styles.tooltip}
          data-testid="minimap-tooltip"
          style={{ left: `${hover.xRatio * 100}%` }}
          role="tooltip"
        >
          <div className={styles.tooltipDate}>
            {formatYear(Math.round(hover.year))}
          </div>
          <div className={styles.tooltipRow}>
            People: {hover.peopleDepth} rows
          </div>
          <div className={styles.tooltipRow}>
            Conflicts+Milestones: {hover.eventsDepth} rows
          </div>
        </div>
      )}
    </div>
  );
}
