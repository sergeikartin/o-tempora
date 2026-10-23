import type * as d3 from 'd3';
import {
  type CSSProperties,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  formatYear,
  isRoundTickYear,
  roundTickYearsInRange,
} from '../../shared/lib/date';
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
  type ZoomAnimationHandle,
  zoomAnimationCounterScaleCss,
  zoomAnimationGroupTransformCss,
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

// startYear/endYear arrive pre-buffered past the viewport edge and d3 scales
// extrapolate, so near either end of the timeline the range can reach years
// the scale wasn't built for (e.g. past today). Clamping to the scale's domain
// keeps each label's x inside [0, totalWidth]; an unclamped label would grow
// the scroll container's scrollWidth and let users scroll into blank space.
function decadeLabelsInRange(
  startYear: number,
  endYear: number,
  xScale: d3.ScaleLinear<number, number>,
): DecadeLabel[] {
  const [domainStart, domainEnd] = xScale.domain();
  const clampedStart = Math.max(startYear, domainStart ?? startYear);
  const clampedEnd = Math.min(endYear, domainEnd ?? endYear);
  return roundTickYearsInRange(clampedStart, clampedEnd, DECADE_STEP_YEARS).map(
    (year) => ({
      year,
      x: xScale(year),
      isCentury: isRoundTickYear(year, CENTURY_STEP_YEARS),
    }),
  );
}

// The ruler's ticks are pure CSS: two layered repeating background gradients
// on .ruler (decade/century, see YearAxis.module.css), sized and phased via
// the custom properties below, not one DOM node per tick. Their cost is flat
// however wide the timeline gets, so only the decade number labels are DOM
// elements: a plain positioned list (no D3 join, since there is no enter/exit
// choreography), windowed to visibleStartYear/visibleEndYear.
export const YearAxis = forwardRef<ZoomAnimationHandle, YearAxisProps>(
  function YearAxis({ xScale, visibleStartYear, visibleEndYear }, ref) {
    const axisRef = useRef<HTMLDivElement>(null);
    const totalWidth = xScale.range()[1] ?? 0;
    const pixelsPerYear = xScale(1) - xScale(0);
    const showDecadeLabels =
      pixelsPerYear * DECADE_STEP_YEARS >= MIN_DECADE_LABEL_SPACING_PX;

    const labels = useMemo(
      () => decadeLabelsInRange(visibleStartYear, visibleEndYear, xScale),
      [xScale, visibleStartYear, visibleEndYear],
    );

    const sharedTickSizeVars = {
      '--decade-tick-px': `${pixelsPerYear * DECADE_STEP_YEARS}px`,
      '--century-tick-px': `${pixelsPerYear * CENTURY_STEP_YEARS}px`,
    };

    // Round BCE ticks (format-year.ts) sit on a different phase than CE ticks and
    // the year-0 boundary tick (options.ts's phaseOffsetYears), so the ruler is
    // two adjacent, independently phased regions split at year 0.
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

    // The zoom animation's rAF loop writes transforms straight to this root div
    // and every .year-axis-label-scale span, bypassing React; reset them in the
    // same effect that lands new label positions so the commit is atomic (see
    // PeopleLane).
    // biome-ignore lint/correctness/useExhaustiveDependencies: xScale isn't read in the body — it's a trigger so this transform reset commits atomically with the new label positions above, on the same xScale change
    useLayoutEffect(() => {
      const axis = axisRef.current;
      if (!axis) return;
      axis.style.transform = '';
      axis.style.willChange = '';
      axis
        .querySelectorAll<HTMLElement>('.year-axis-label-scale')
        .forEach((el) => {
          el.style.transform = '';
        });
    }, [xScale]);

    // Called every frame by TimelineCanvas's single rAF driver (see options.ts's
    // ZoomAnimationTransform). The whole axis gets the group transform; each label
    // also gets a counter-scale on an inner span so its text doesn't stretch. The
    // outer span (queried here) keeps its unanimated `left`/centering untouched, so
    // nothing has to compose with it.
    useImperativeHandle(
      ref,
      () => ({
        beginZoomAnimation() {
          const axis = axisRef.current;
          if (!axis) return;
          axis.style.willChange = 'transform';
        },
        applyZoomTransform(transform) {
          const axis = axisRef.current;
          if (!axis) return;
          axis.style.transform = zoomAnimationGroupTransformCss(transform);
          axis
            .querySelectorAll<HTMLElement>('.year-axis-label-scale')
            .forEach((el) => {
              el.style.transform = zoomAnimationCounterScaleCss(transform.sx);
            });
        },
      }),
      [],
    );

    return (
      <div
        ref={axisRef}
        className={styles.axis}
        style={{ width: totalWidth, height: AXIS_HEIGHT }}
      >
        <div className={styles.rulerRow} style={{ width: totalWidth }}>
          <div
            className={`year-axis-ruler-bce ${styles.ruler}`}
            style={bceRulerStyle}
          />
          <div
            className={`year-axis-ruler ${styles.ruler}`}
            style={ceRulerStyle}
          />
        </div>
        <div
          className={styles.labelRow}
          style={{ height: RULER_LABEL_ROW_HEIGHT }}
        >
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
  },
);
