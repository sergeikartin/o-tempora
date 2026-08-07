import { useMemo, type CSSProperties } from 'react';
import * as d3 from 'd3';
import { formatYear } from '../../shared/lib/format-year';
import {
  AXIS_HEIGHT,
  CENTURY_STEP_YEARS,
  CENTURY_TICK_PHASE_OFFSET_YEARS,
  DECADE_STEP_YEARS,
  DECADE_TICK_PHASE_OFFSET_YEARS,
  MIN_DECADE_LABEL_SPACING_PX,
  RULER_HEIGHT,
  RULER_LABEL_ROW_HEIGHT,
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
  const first = Math.ceil(clampedStart / DECADE_STEP_YEARS) * DECADE_STEP_YEARS;
  const labels: DecadeLabel[] = [];
  for (let year = first; year <= clampedEnd; year += DECADE_STEP_YEARS) {
    labels.push({ year, x: xScale(year), isCentury: year % CENTURY_STEP_YEARS === 0 });
  }
  return labels;
}

// The ruler's tick marks are pure CSS — three layered repeating background-
// gradients on .ruler (year/decade/century, see YearAxis.module.css), sized
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
export function YearAxis({ xScale, visibleStartYear, visibleEndYear }: YearAxisProps) {
  const totalWidth = xScale.range()[1] ?? 0;
  const pixelsPerYear = xScale(1) - xScale(0);
  const showDecadeLabels = pixelsPerYear * DECADE_STEP_YEARS >= MIN_DECADE_LABEL_SPACING_PX;

  const labels = useMemo(
    () => decadeLabelsInRange(visibleStartYear, visibleEndYear, xScale),
    [xScale, visibleStartYear, visibleEndYear],
  );

  const rulerStyle = {
    height: RULER_HEIGHT,
    '--year-tick-px': `${pixelsPerYear}px`,
    '--decade-tick-px': `${pixelsPerYear * DECADE_STEP_YEARS}px`,
    '--century-tick-px': `${pixelsPerYear * CENTURY_STEP_YEARS}px`,
    '--decade-tick-offset-px': `${pixelsPerYear * DECADE_TICK_PHASE_OFFSET_YEARS}px`,
    '--century-tick-offset-px': `${pixelsPerYear * CENTURY_TICK_PHASE_OFFSET_YEARS}px`,
  } as CSSProperties;

  return (
    <div className={styles.axis} style={{ width: totalWidth, height: AXIS_HEIGHT }}>
      <div className={`year-axis-ruler ${styles.ruler}`} style={rulerStyle} />
      <div className={styles.labelRow} style={{ height: RULER_LABEL_ROW_HEIGHT }}>
        {labels.map((label) =>
          label.isCentury || showDecadeLabels ? (
            <span
              key={label.year}
              className={`year-axis-label ${styles.label} ${label.isCentury ? `year-axis-label-century ${styles.centuryLabel}` : ''}`}
              style={{ left: label.x }}
            >
              {formatYear(label.year)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
