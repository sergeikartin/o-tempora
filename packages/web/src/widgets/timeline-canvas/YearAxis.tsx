import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as d3 from 'd3';
import { formatYear, isRoundTickYear, roundTickYearsInRange } from '../../shared/lib/format-year';
import {
  AXIS_HEIGHT,
  BCE_CENTURY_TICK_PHASE_OFFSET_YEARS,
  BCE_DECADE_TICK_PHASE_OFFSET_YEARS,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  MIN_DECADE_LABEL_SPACING_PX,
  RULER_HEIGHT,
  RULER_LABEL_ROW_HEIGHT,
  zoomAnimationCounterScaleCss,
  zoomAnimationGroupTransformCss,
  type ZoomAnimationHandle,
} from './options';
import styles from './YearAxis.module.css';

interface YearAxisProps {
  xScale: d3.ScaleLinear<number, number>;
  /** Buffered visible year range (see TimelineCanvas's VIEWPORT_BUFFER_RATIO) — labels outside it aren't rendered. */
  visibleStartYear: number;
  visibleEndYear: number;
}

interface DecadeLabel {
  year: number;
  x: number;
  isCentury: boolean;
}

// startYear/endYear come in pre-buffered past the viewport edge (see
// TimelineCanvas's VIEWPORT_BUFFER_RATIO) and d3 scales extrapolate freely
// past their domain, so near either end of the timeline the buffered range
// can reach years the scale was never built for — e.g. past today on the
// right. Clamping to the scale's own domain keeps every label's x inside
// [0, totalWidth]; nothing here clips horizontal overflow, so an
// unclamped label would silently grow the scroll container's scrollWidth,
// letting a user scroll past the timeline's real bounds into blank space.
function decadeLabelsInRange(startYear: number, endYear: number, xScale: d3.ScaleLinear<number, number>): DecadeLabel[] {
  const [domainStart, domainEnd] = xScale.domain();
  const clampedStart = Math.max(startYear, domainStart ?? startYear);
  const clampedEnd = Math.min(endYear, domainEnd ?? endYear);
  return roundTickYearsInRange(clampedStart, clampedEnd, DECADE_STEP_YEARS).map((year) => ({
    year,
    x: xScale(year),
    isCentury: isRoundTickYear(year, CENTURY_STEP_YEARS),
  }));
}

// The ruler's tick marks are pure CSS — two layered repeating background-
// gradients on .ruler (decade/century, see YearAxis.module.css), sized
// and phase-aligned via the CSS custom properties set below — rather than
// one DOM node per tick. Their rendering cost is ~flat no matter how wide
// the scrollable timeline gets, so unlike every other lane they need no
// viewport-windowing at all; this replaces an earlier design (first d3's
// adaptive axisBottom, then a fixed-step D3 join) that generated a real DOM
// node per tick and made the axis the single biggest contributor to
// initial-load time. Only the decade number labels are real DOM elements —
// a plain positioned list, no D3 join, since there's no per-item enter/exit
// choreography here to justify one — and so are windowed to visibleStartYear/
// visibleEndYear, same as everything else.
export const YearAxis = forwardRef<ZoomAnimationHandle, YearAxisProps>(function YearAxis(
  { xScale, visibleStartYear, visibleEndYear },
  ref,
) {
  const axisRef = useRef<HTMLDivElement>(null);
  const totalWidth = xScale.range()[1] ?? 0;
  const pixelsPerYear = xScale(1) - xScale(0);
  const showDecadeLabels = pixelsPerYear * DECADE_STEP_YEARS >= MIN_DECADE_LABEL_SPACING_PX;

  const labels = useMemo(
    () => decadeLabelsInRange(visibleStartYear, visibleEndYear, xScale),
    [xScale, visibleStartYear, visibleEndYear],
  );

  const sharedTickSizeVars = {
    '--decade-tick-px': `${pixelsPerYear * DECADE_STEP_YEARS}px`,
    '--century-tick-px': `${pixelsPerYear * CENTURY_STEP_YEARS}px`,
  };

  // Round-historical BCE ticks (format-year.ts) sit on a different phase
  // than CE ticks and the era-boundary tick at year 0 — see options.ts's
  // phaseOffsetYears — so the ruler is two adjacent, independently-phased
  // regions split at year 0, not one continuous background.
  const boundaryX = Math.min(Math.max(xScale(0), 0), totalWidth);
  const bceRulerStyle = {
    height: RULER_HEIGHT,
    width: boundaryX,
    ...sharedTickSizeVars,
    '--decade-tick-offset-px': `${pixelsPerYear * BCE_DECADE_TICK_PHASE_OFFSET_YEARS}px`,
    '--century-tick-offset-px': `${pixelsPerYear * BCE_CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;
  const ceRulerStyle = {
    height: RULER_HEIGHT,
    width: totalWidth - boundaryX,
    ...sharedTickSizeVars,
    '--decade-tick-offset-px': `${pixelsPerYear * DECADE_TICK_PHASE_OFFSET_YEARS}px`,
    '--century-tick-offset-px': `${pixelsPerYear * CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;

  // A zoom animation's rAF loop (see the imperative handle below) writes a
  // transform straight to this root div and every .year-axis-label-scale
  // span every tick, without going through React (these are plain HTML, no
  // D3) — reset it here, in the same effect that lands new label positions
  // for a changed xScale, so the commit is atomic (see PeopleLane's
  // identical comment for why this can't be a frame later).
  useLayoutEffect(() => {
    const axis = axisRef.current;
    if (!axis) return;
    axis.style.transform = '';
    axis.querySelectorAll<HTMLElement>('.year-axis-label-scale').forEach((el) => {
      el.style.transform = '';
    });
  }, [xScale]);

  // TimelineCanvas's single rAF driver calls this every animation-frame
  // tick, once per lane/axis — see options.ts's ZoomAnimationTransform
  // comment for the mechanism. The whole axis (ruler backgrounds + label
  // row) gets the group transform; each label additionally gets a counter-
  // scale on an inner span so its own text doesn't stretch — the outer
  // span (queried here) keeps the unanimated `left`/centering that
  // positions it, untouched, so this never has to reason about composing
  // with that existing transform.
  useImperativeHandle(
    ref,
    () => ({
      applyZoomTransform(transform) {
        const axis = axisRef.current;
        if (!axis) return;
        axis.style.transform = zoomAnimationGroupTransformCss(transform);
        axis.querySelectorAll<HTMLElement>('.year-axis-label-scale').forEach((el) => {
          el.style.transform = zoomAnimationCounterScaleCss(transform.sx);
        });
      },
    }),
    [],
  );

  return (
    <div ref={axisRef} className={styles.axis} style={{ width: totalWidth, height: AXIS_HEIGHT }}>
      <div className={styles.rulerRow} style={{ width: totalWidth }}>
        <div className={`year-axis-ruler-bce ${styles.ruler}`} style={bceRulerStyle} />
        <div className={`year-axis-ruler ${styles.ruler}`} style={ceRulerStyle} />
      </div>
      <div className={styles.labelRow} style={{ height: RULER_LABEL_ROW_HEIGHT }}>
        {labels.map((label) =>
          label.isCentury || showDecadeLabels ? (
            <span
              key={label.year}
              className={`year-axis-label ${styles.label} ${label.isCentury ? `year-axis-label-century ${styles.centuryLabel}` : ''}`}
              style={{ left: label.x }}
            >
              <span
                className={`year-axis-label-scale ${styles.labelScale} ${label.isCentury ? styles.centuryLabelScale : ''}`}
              >
                {formatYear(label.year)}
              </span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
});
