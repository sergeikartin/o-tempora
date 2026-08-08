import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { WarsAndConflictsEntry } from '../../shared/types';
import { assignRows, mapWars } from './map-to-items';
import {
  CATEGORY_COLORS,
  MIN_ROW_GAP_PX,
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
  estimateLabelWidthPx,
  labelYForRow,
  markerCenterYForRow,
  markerLaneHeight,
} from './options';
import styles from './WarsLane.module.css';

interface RangeLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  row: number;
  fill: string;
}

interface PointLayout {
  id: string;
  name: string;
  x: number;
  row: number;
  fill: string;
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
// as a rounded-cap line, points as a dot. An item that would otherwise
// collide with a neighbor doesn't move sideways; `assignRows`' row instead
// pushes its marker+label pair down together (markerCenterYForRow/
// labelYForRow), the label sitting just below its own row's marker. Same
// below-marker treatment Events & Inventions uses for its dots.
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
        g.append('line')
          .attr('class', `d3-line ${styles.line}`)
          .attr('stroke-width', PERIOD_LINE_HEIGHT)
          .attr('stroke-linecap', 'round');
        g.append('text')
          .attr('class', `d3-range-name ${styles.label}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    rangeGroups.attr('data-row', (d) => d.row);

    rangeGroups
      .select<SVGLineElement>('.d3-line')
      .attr('x1', (d) => d.x1)
      .attr('x2', (d) => d.x2)
      .attr('y1', (d) => markerCenterYForRow(d.row))
      .attr('y2', (d) => markerCenterYForRow(d.row))
      .attr('stroke', (d) => d.fill)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'war');

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
        g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        g.append('text')
          .attr('class', `d3-point-name ${styles.label}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    pointGroups.attr('data-row', (d) => d.row);

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => markerCenterYForRow(d.row))
      .attr('fill', (d) => d.fill)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'war');

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
