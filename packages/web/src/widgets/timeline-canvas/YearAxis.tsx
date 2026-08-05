import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { centuryBoundariesInRange, formatYear, type CenturyBoundary } from '../../shared/lib/format-year';
import { AXIS_HEIGHT, MAJOR_HEADER_HEIGHT } from './options';
import styles from './YearAxis.module.css';

interface YearAxisProps {
  xScale: d3.ScaleLinear<number, number>;
}

// Target pixel spacing between minor ticks — d3's own axis generator has no
// concept of the viewport within this scrollable width, so the tick count
// hint has to be derived from totalWidth (spanning the whole dataset), not
// the visible clientWidth, or most of the scrollable range would render with
// no ticks in it at all. d3's tick algorithm then snaps to a "nice"
// 1/2/5x10^n step, so the actually-rendered gap oscillates around this
// target (verified at a few representative pixelsPerYear values across the
// CORE/NOTABLE/EXHAUSTIVE zoom range) rather than landing on it exactly at
// every zoom level.
const TARGET_TICK_SPACING_PX = 70;

interface CenturySegment extends CenturyBoundary {
  key: string;
  x: number;
}

// The one lane-row that renders off d3's own axisBottom generator (the
// minor-tick row) plus a second, custom-joined major header row above it —
// there's no per-entity data here, just tick marks/year labels and computed
// century boundaries, both derived from the shared xScale. Years are plain
// numbers (BCE negative, ISO/astronomical numbering) end-to-end, displayed
// via the shared formatYear/centuryBoundariesInRange utility rather than a
// duplicated BCE/CE check.
export function YearAxis({ xScale }: YearAxisProps) {
  const minorRef = useRef<SVGGElement>(null);
  const majorRef = useRef<SVGGElement>(null);
  const totalWidth = xScale.range()[1] ?? 0;

  useEffect(() => {
    if (!minorRef.current) return;
    const tickCount = Math.max(1, Math.round(totalWidth / TARGET_TICK_SPACING_PX));
    d3.select(minorRef.current).call(
      d3
        .axisBottom(xScale)
        .ticks(tickCount)
        .tickSizeOuter(0)
        .tickFormat((year) => formatYear(Number(year))),
    );
  }, [xScale, totalWidth]);

  useEffect(() => {
    if (!majorRef.current) return;

    const [domainStart = 0, domainEnd = 0] = xScale.domain();
    const segments: CenturySegment[] = centuryBoundariesInRange(domainStart, domainEnd).map((boundary) => ({
      ...boundary,
      key: `${boundary.startYear}`,
      x: (xScale(boundary.startYear) + xScale(boundary.endYear + 1)) / 2,
    }));

    const groups = d3
      .select(majorRef.current)
      .selectAll<SVGGElement, CenturySegment>('g.d3-century')
      .data(segments, (d) => d.key)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-century');
        g.append('line').attr('class', `d3-century-divider ${styles.divider}`);
        g.append('text')
          .attr('class', `d3-century-label ${styles.label}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    groups
      .select<SVGLineElement>('.d3-century-divider')
      .attr('x1', (d) => xScale(d.startYear))
      .attr('x2', (d) => xScale(d.startYear))
      .attr('y1', 0)
      .attr('y2', MAJOR_HEADER_HEIGHT);

    groups
      .select<SVGTextElement>('.d3-century-label')
      .attr('x', (d) => d.x)
      .attr('y', 1)
      .text((d) => d.label);
  }, [xScale, totalWidth]);

  return (
    <svg width={totalWidth} height={AXIS_HEIGHT} className={styles.svg}>
      <g ref={majorRef} className={`d3-century-row ${styles.majorRow}`} />
      <g ref={minorRef} className={`d3-axis ${styles.axis}`} transform={`translate(0, ${MAJOR_HEADER_HEIGHT})`} />
    </svg>
  );
}
