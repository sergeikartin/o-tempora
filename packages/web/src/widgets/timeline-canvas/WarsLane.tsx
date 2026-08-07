import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { WarsAndConflictsEntry } from '../../shared/types';
import { assignRows, mapWars } from './map-to-items';
import {
  CATEGORY_COLORS,
  MARKER_CENTER_Y,
  MIN_ROW_GAP_PX,
  POINT_RADIUS,
  RANGE_LINE_HEIGHT,
  estimateLabelWidthPx,
  labelYForRow,
  markerLaneHeight,
  stemBottomForRow,
} from './options';
import styles from './WarsLane.module.css';

interface RangeLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  row: number;
  fill: string;
  tooltip: string;
}

interface PointLayout {
  id: string;
  name: string;
  x: number;
  row: number;
  fill: string;
  tooltip: string;
}

interface WarsLaneProps {
  wars: WarsAndConflictsEntry[];
  xScale: d3.ScaleLinear<number, number>;
}

// Row-stacking here works in screen pixels, not years (see map-to-items.ts's
// assignRows) — a range's line width and a point's label can both extend
// well past what a year-based gap would predict, especially at low zoom.
function pixelInterval(item: { startYear: number; endYear: number; name: string; isPoint: boolean }, xScale: d3.ScaleLinear<number, number>) {
  if (item.isPoint) {
    const x = xScale(item.startYear);
    const labelHalf = estimateLabelWidthPx(item.name) / 2;
    return { start: Math.min(x - POINT_RADIUS, x - labelHalf), end: Math.max(x + POINT_RADIUS, x + labelHalf) };
  }
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const center = (x1 + x2) / 2;
  const labelHalf = estimateLabelWidthPx(item.name) / 2;
  return { start: Math.min(x1, center - labelHalf), end: Math.max(x2, center + labelHalf) };
}

// Wars & Conflicts renders two shapes sharing one row-stacking pass: ranges
// as a thin horizontal line, points as a dot — both always centered on
// MARKER_CENTER_Y, the same fixed y right under the shared YearAxis, so a
// marker's x-position always reads directly against the axis above it. An
// item that would otherwise collide with a neighbor doesn't move its marker;
// `assignRows`' row becomes a stem-length tier instead, pushing just that
// item's label (and the stem connecting it back up to the marker) further
// down. Same below-marker treatment Events & Inventions uses for its dots.
export function WarsLane({ wars, xScale }: WarsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapWars(wars), [wars]);
  const rowOfWar = useMemo(() => {
    const intervals = items.map((item) => {
      const { start, end } = pixelInterval(item, xScale);
      return { id: item.id, startYear: start, endYear: end };
    });
    return assignRows(intervals, MIN_ROW_GAP_PX);
  }, [items, xScale]);
  const rowCount = rowOfWar.size > 0 ? Math.max(...rowOfWar.values()) + 1 : 0;
  const totalHeight = markerLaneHeight(rowCount);
  const totalWidth = xScale.range()[1] ?? 0;

  const rangeLayout: RangeLayout[] = useMemo(
    () =>
      items
        .filter((item) => !item.isPoint)
        .map((item) => ({
          id: item.id,
          name: item.name,
          x1: xScale(item.startYear),
          x2: xScale(item.endYear),
          row: rowOfWar.get(item.id) ?? 0,
          fill: CATEGORY_COLORS[item.category],
          tooltip: item.tooltip,
        })),
    [items, rowOfWar, xScale],
  );

  const pointLayout: PointLayout[] = useMemo(
    () =>
      items
        .filter((item) => item.isPoint)
        .map((item) => ({
          id: item.id,
          name: item.name,
          x: xScale(item.startYear),
          row: rowOfWar.get(item.id) ?? 0,
          fill: CATEGORY_COLORS[item.category],
          tooltip: item.tooltip,
        })),
    [items, rowOfWar, xScale],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const rangeGroups = svg
      .select<SVGGElement>('g.ranges')
      .selectAll<SVGGElement, RangeLayout>('g.d3-range')
      .data(rangeLayout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-range');
        g.append('line').attr('class', `d3-stem ${styles.stem}`).attr('stroke-width', 1.5);
        const line = g.append('rect').attr('class', `d3-line ${styles.line}`).attr('height', RANGE_LINE_HEIGHT);
        line.append('title');
        g.append('text')
          .attr('class', `d3-range-name ${styles.label}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    rangeGroups.attr('data-row', (d) => d.row);

    rangeGroups
      .select<SVGLineElement>('.d3-stem')
      .attr('x1', (d) => (d.x1 + d.x2) / 2)
      .attr('x2', (d) => (d.x1 + d.x2) / 2)
      .attr('y1', MARKER_CENTER_Y + RANGE_LINE_HEIGHT / 2)
      .attr('y2', (d) => stemBottomForRow(d.row))
      .attr('stroke', (d) => d.fill);

    rangeGroups
      .select<SVGRectElement>('.d3-line')
      .attr('x', (d) => d.x1)
      .attr('y', MARKER_CENTER_Y - RANGE_LINE_HEIGHT / 2)
      .attr('width', (d) => Math.max(d.x2 - d.x1, 2))
      .attr('fill', (d) => d.fill);

    rangeGroups.select('.d3-line title').text((d) => d.tooltip);

    rangeGroups
      .select<SVGTextElement>('.d3-range-name')
      .attr('x', (d) => (d.x1 + d.x2) / 2)
      .attr('y', (d) => labelYForRow(d.row))
      .attr('fill', (d) => d.fill)
      .text((d) => d.name);

    const pointGroups = svg
      .select<SVGGElement>('g.points')
      .selectAll<SVGGElement, PointLayout>('g.d3-point-group')
      .data(pointLayout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-point-group');
        g.append('line').attr('class', `d3-stem ${styles.stem}`).attr('stroke-width', 1.5);
        const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        dot.append('title');
        g.append('text')
          .attr('class', `d3-point-name ${styles.label}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    pointGroups.attr('data-row', (d) => d.row);

    pointGroups
      .select<SVGLineElement>('.d3-stem')
      .attr('x1', (d) => d.x)
      .attr('x2', (d) => d.x)
      .attr('y1', MARKER_CENTER_Y + POINT_RADIUS)
      .attr('y2', (d) => stemBottomForRow(d.row))
      .attr('stroke', (d) => d.fill);

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', MARKER_CENTER_Y)
      .attr('fill', (d) => d.fill);

    pointGroups.select('.d3-dot title').text((d) => d.tooltip);

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x)
      .attr('y', (d) => labelYForRow(d.row))
      .attr('fill', (d) => d.fill)
      .text((d) => d.name);
  }, [rangeLayout, pointLayout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="ranges" />
      <g className="points" />
    </svg>
  );
}
