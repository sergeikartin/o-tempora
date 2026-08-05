import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { War } from '../../shared/types';
import { assignRows, mapWars } from './map-to-items';
import { BAR_HEIGHT, CATEGORY_COLORS, LANE_TOP_PADDING, POINT_RADIUS, ROW_PITCH } from './options';
import styles from './WarsLane.module.css';

interface RangeLayout {
  id: string;
  name: string;
  x: number;
  width: number;
  y: number;
  fill: string;
  tooltip: string;
}

interface PointLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  fill: string;
  tooltip: string;
}

interface WarsLaneProps {
  wars: War[];
  xScale: d3.ScaleLinear<number, number>;
}

export function WarsLane({ wars, xScale }: WarsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapWars(wars), [wars]);
  const rowOfWar = useMemo(() => assignRows(items), [items]);
  const rowCount = rowOfWar.size > 0 ? Math.max(...rowOfWar.values()) + 1 : 0;
  const totalHeight = rowCount * ROW_PITCH + LANE_TOP_PADDING;
  const totalWidth = xScale.range()[1] ?? 0;

  const rangeLayout: RangeLayout[] = useMemo(
    () =>
      items
        .filter((item) => !item.isPoint)
        .map((item) => {
          const row = rowOfWar.get(item.id) ?? 0;
          return {
            id: item.id,
            name: item.name,
            x: xScale(item.startYear),
            width: Math.max(xScale(item.endYear) - xScale(item.startYear), 2),
            y: LANE_TOP_PADDING + row * ROW_PITCH,
            fill: CATEGORY_COLORS[item.category],
            tooltip: item.tooltip,
          };
        }),
    [items, rowOfWar, xScale],
  );

  const pointLayout: PointLayout[] = useMemo(
    () =>
      items
        .filter((item) => item.isPoint)
        .map((item) => {
          const row = rowOfWar.get(item.id) ?? 0;
          return {
            id: item.id,
            name: item.name,
            x: xScale(item.startYear),
            y: LANE_TOP_PADDING + row * ROW_PITCH,
            fill: CATEGORY_COLORS[item.category],
            tooltip: item.tooltip,
          };
        }),
    [items, rowOfWar, xScale],
  );

  // Two independent D3 joins under <g class="wars">: <g class="ranges"> for
  // multi-year wars (bar + clipped name, same shape as PeopleLane's bars but
  // with no reign-period overlay/subgroup logic), <g class="points"> for
  // single-date entries (battle, treaty, etc.) as a dot + unclipped label.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const rangeGroups = svg
      .select<SVGGElement>('g.ranges')
      .selectAll<SVGGElement, RangeLayout>('g.d3-range')
      .data(rangeLayout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-range');
        g.append('clipPath')
          .attr('id', (d) => `clip-${d.id}`)
          .append('rect')
          .attr('class', 'd3-clip-rect')
          .attr('height', BAR_HEIGHT)
          .attr('rx', 4);
        const bar = g.append('rect').attr('class', `d3-bar ${styles.bar}`).attr('height', BAR_HEIGHT).attr('rx', 4);
        bar.append('title');
        g.append('text').attr('class', `d3-bar-name ${styles.name}`).attr('dominant-baseline', 'middle');
        return g;
      });

    // Row position lives on the wrapper group too (not just the bar/dot's own
    // y/cy attribute) so both shapes expose it under one consistent name.
    rangeGroups.attr('data-row-y', (d) => d.y);

    rangeGroups
      .select<SVGRectElement>('.d3-clip-rect')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width);

    rangeGroups
      .select<SVGRectElement>('.d3-bar')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width)
      .attr('fill', (d) => d.fill);

    rangeGroups.select('.d3-bar title').text((d) => d.tooltip);

    rangeGroups
      .select<SVGTextElement>('.d3-bar-name')
      .attr('x', (d) => d.x + 4)
      .attr('y', (d) => d.y + BAR_HEIGHT / 2)
      .attr('clip-path', (d) => `url(#clip-${d.id})`)
      .text((d) => d.name);

    const pointGroups = svg
      .select<SVGGElement>('g.points')
      .selectAll<SVGGElement, PointLayout>('g.d3-point-group')
      .data(pointLayout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-point-group');
        const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        dot.append('title');
        g.append('text').attr('class', `d3-point-name ${styles.pointName}`).attr('dominant-baseline', 'middle');
        return g;
      });

    pointGroups.attr('data-row-y', (d) => d.y);

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y + BAR_HEIGHT / 2)
      .attr('fill', (d) => d.fill);

    pointGroups.select('.d3-dot title').text((d) => d.tooltip);

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x + POINT_RADIUS + 4)
      .attr('y', (d) => d.y + BAR_HEIGHT / 2)
      .text((d) => d.name);
  }, [rangeLayout, pointLayout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="ranges" />
      <g className="points" />
    </svg>
  );
}
