import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AXIS_HEIGHT } from './options';
import styles from './YearAxis.module.css';

interface YearAxisProps {
  xScale: d3.ScaleLinear<number, number>;
}

// Target pixel spacing between ticks — d3's own axis generator has no
// concept of "the viewport within this scrollable width", so the tick count
// hint has to be derived from totalWidth (spanning the whole dataset), not
// the visible clientWidth, or most of the scrollable range would render with
// no ticks in it at all.
const TARGET_TICK_SPACING_PX = 80;

// The one lane-row that renders off d3's own axisBottom generator instead of
// a manual per-item join — there's no per-entity data here, just tick marks
// and year labels (plain numbers, BCE negative — same convention as
// everywhere else in the rendering path) derived from the shared xScale.
export function YearAxis({ xScale }: YearAxisProps) {
  const gRef = useRef<SVGGElement>(null);
  const totalWidth = xScale.range()[1] ?? 0;

  useEffect(() => {
    if (!gRef.current) return;
    const tickCount = Math.max(1, Math.round(totalWidth / TARGET_TICK_SPACING_PX));
    d3.select(gRef.current).call(
      d3
        .axisBottom(xScale)
        .ticks(tickCount)
        .tickSizeOuter(0)
        // d3's default tickFormat comma-groups thousands ("1,800") with a
        // Unicode minus — plain JS number-to-string matches the rest of the
        // rendering path's "plain numbers end-to-end (BCE negative)" rule.
        .tickFormat((year) => String(year)),
    );
  }, [xScale, totalWidth]);

  return (
    <svg width={totalWidth} height={AXIS_HEIGHT} className={styles.svg}>
      <g ref={gRef} className={`d3-axis ${styles.axis}`} />
    </svg>
  );
}
