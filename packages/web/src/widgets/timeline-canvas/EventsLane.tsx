import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Discovery } from '../../shared/types';
import { assignRows, mapDiscoveries } from './map-to-items';
import {
  CATEGORY_COLORS,
  LANE_TOP_PADDING,
  MARKER_ROW_PITCH,
  MIN_ROW_GAP_PX,
  POINT_RADIUS,
  STEM_HEIGHT,
  estimateLabelWidthPx,
} from './options';
import styles from './EventsLane.module.css';

interface PointLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  fill: string;
  tooltip: string;
}

interface EventsLaneProps {
  discoveries: Discovery[];
  xScale: d3.ScaleLinear<number, number>;
}

// discoveries.json is always single-year, so every entry is a point — but
// with 24+ items and long names, points can cluster close enough in pixels
// (even years apart, at low zoom) for labels to overlap, so points still
// need row-stacking. There's no year-range to stack on (unlike People/Wars),
// so this stacks on each point's estimated below-marker label pixel-extent
// (see map-to-items.ts's assignRows) instead.
export function EventsLane({ discoveries, xScale }: EventsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapDiscoveries(discoveries), [discoveries]);
  const rowOfItem = useMemo(() => {
    const labelExtents = items.map((item) => {
      const x = xScale(item.startYear);
      const labelHalf = estimateLabelWidthPx(item.name) / 2;
      return {
        id: item.id,
        startYear: Math.min(x - POINT_RADIUS, x - labelHalf),
        endYear: Math.max(x + POINT_RADIUS, x + labelHalf),
      };
    });
    return assignRows(labelExtents, MIN_ROW_GAP_PX);
  }, [items, xScale]);
  const rowCount = rowOfItem.size > 0 ? Math.max(...rowOfItem.values()) + 1 : 0;
  const totalHeight = rowCount * MARKER_ROW_PITCH + LANE_TOP_PADDING;
  const totalWidth = xScale.range()[1] ?? 0;

  const layout: PointLayout[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        x: xScale(item.startYear),
        y: LANE_TOP_PADDING + (rowOfItem.get(item.id) ?? 0) * MARKER_ROW_PITCH,
        fill: CATEGORY_COLORS[item.category],
        tooltip: item.tooltip,
      })),
    [items, rowOfItem, xScale],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const pointGroups = svg
      .select<SVGGElement>('g.points')
      .selectAll<SVGGElement, PointLayout>('g.d3-point-group')
      .data(layout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-point-group');
        g.append('line').attr('class', `d3-stem ${styles.stem}`).attr('stroke-width', 1.5);
        const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        dot.append('title');
        g.append('text')
          .attr('class', `d3-point-name ${styles.pointName}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    pointGroups
      .select<SVGLineElement>('.d3-stem')
      .attr('x1', (d) => d.x)
      .attr('x2', (d) => d.x)
      .attr('y1', (d) => d.y + POINT_RADIUS * 2)
      .attr('y2', (d) => d.y + POINT_RADIUS * 2 + STEM_HEIGHT)
      .attr('stroke', (d) => d.fill);

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y + POINT_RADIUS)
      .attr('fill', (d) => d.fill);

    pointGroups.select('.d3-dot title').text((d) => d.tooltip);

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y + POINT_RADIUS * 2 + STEM_HEIGHT)
      .attr('fill', (d) => d.fill)
      .text((d) => d.name);
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="points" />
    </svg>
  );
}
