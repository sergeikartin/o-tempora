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

// Enforced via CSS min-width on .viewportRect; the drag math needs the same
// floor to convert a pointer move into a scrollLeft delta.
const MIN_VIEWPORT_RECT_PX = 24;

// SVG viewBox space for the ridge: arbitrary units scaled to the track by
// preserveAspectRatio="none", so resizing never recomputes the path.
const RIDGE_VIEWBOX_HEIGHT = 100;
const RIDGE_BASELINE = RIDGE_VIEWBOX_HEIGHT / 2;

// Rough per-character width for the century strip's 9px labels (see
// options.ts's AVG_CHAR_WIDTH_PX, tuned for 11px) plus breathing room; enough
// to bound label width for the thinning pass without DOM measurement.
const CENTURY_LABEL_CHAR_WIDTH_PX = 5;
const CENTURY_LABEL_GAP_PX = 6;

function estimateCenturyLabelWidthPx(label: string): number {
  return label.length * CENTURY_LABEL_CHAR_WIDTH_PX + CENTURY_LABEL_GAP_PX;
}

interface MinimapProps {
  // Already fame-filtered by the caller; the profile recomputes on every
  // fame-score change, so it reflects the visible entity set
  // (web/docs/adr/0004).
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  // Resolves an id set to its rows, with the same resolvers PeopleLane and
  // ConflictsMilestonesLane use (map-to-items.ts's computeRowAssignment), called
  // with the filtered ids so the depth matches what is stacked on canvas.
  personRowFor: (ids: string[]) => Map<string, number>;
  eventsRowFor: (ids: string[]) => Map<string, number>;
  // The live scroll geometry TimelineCanvas tracks, used only for the viewport
  // rectangle's ratio math, never for Row Depth (fixed Reference Scale).
  totalWidth: number;
  viewportWidthPx: number;
  scrollLeft: number;
  // Fired continuously while the viewport rect is dragged; applied instantly to
  // stay 1:1 with the pointer (see handleRectPointerMove).
  onScrollLeftChange: (scrollLeft: number) => void;
  // Fired once per track click-to-jump: a discrete target, so the caller glides
  // toward it.
  onScrollLeftJump: (scrollLeft: number) => void;
}

interface HoverInfo {
  xRatio: number;
  year: number;
  peopleDepth: number;
  eventsDepth: number;
}

// An SVG area sparkline over the full pannable range, People's Row Depth
// mirrored above a center baseline against Conflicts+Milestones below
// (web/docs/adr/0004). A press on the track jumps the viewport there, dragging
// the translucent .viewportRect pans, and a hover tooltip gives exact
// date/Row-Depth numbers the log scale compresses away. A decorative century
// tick strip along the top edge never intercepts the track's or rect's
// handlers.
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
  // TimelineCanvas re-measures viewportWidthPx only on mount and zoom, so a
  // window resize leaves it stale while .track (CSS flex) resizes. The rect
  // ratio math tolerates that (re-derived from totalWidth each render), but
  // century-label thinning doesn't: a stale too-wide value would keep labels the
  // narrower strip can't fit. A ResizeObserver keeps this in sync with .track.
  const [measuredTrackWidthPx, setMeasuredTrackWidthPx] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // rAF-batched: at most one re-render per frame during a resize burst.
    let frame = 0;
    let latestWidth: number | undefined;
    const observer = new ResizeObserver((entries) => {
      latestWidth = entries[0]?.contentRect.width;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (latestWidth !== undefined) setMeasuredTrackWidthPx(latestWidth);
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Viewport-rect ratio geometry; effectiveViewportWidthPx is shared with the
  // century-label spacing.
  const effectiveViewportWidthPx =
    viewportWidthPx || FALLBACK_VIEWPORT_WIDTH_PX;
  const effectiveTrackWidthPx =
    measuredTrackWidthPx || effectiveViewportWidthPx;

  // The fixed Reference Scale computeRowAssignment uses, not the live viewport
  // width: row gaps and label widths are fixed pixel quantities, so another
  // pixels-per-year packs differently and the depth shown would disagree with
  // the canvas (web/docs/adr/0004).
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

  // Century-tick strip: ticks at every century boundary across the ridge's
  // domain, built on the same REFERENCE_PIXELS_PER_YEAR scale so they line up
  // with the shape below. Labels use formatYear's numeric style ("1500",
  // "100 BCE"), as YearAxis and the tooltip do, not centuryBoundaryForYear's
  // ordinals. They thin out left to right, keeping a label only if it clears the
  // previous shown label's rendered width; lengths vary ("1800" vs. "800 BCE"),
  // so a flat gap like YearAxis's MIN_DECADE_LABEL_SPACING_PX would overlap.
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
        // Labels are centered under their tick (translateX(-50%)), so collisions are
        // checked on each label's half-widths, not its x position.
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

  // Viewport-rect ratio geometry; effectiveViewportWidthPx is shared with the
  // century-label spacing.
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
    // Stops this press from reaching the track's click-to-jump (React events
    // bubble): a press on the rect drags it instead.
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
    // Same MIN_VIEWPORT_RECT_PX floor as the rect's CSS min-width, so a dragged
    // pixel maps to the scrollLeft distance the rendered rect width implies.
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

  // A press elsewhere on the track jumps to center on that point; the rect drag
  // stops its own press from bubbling here.
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

  // Recovers the precision the log scale compresses: exact date and Row Depth
  // per series at the cursor.
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
        // role="img": a bare div's generic role can't take an accessible name (an
        // aria-label there is invalid ARIA), and img fits a density graphic. The
        // click/drag interaction stays mouse/touch-only like the canvas marks.
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
