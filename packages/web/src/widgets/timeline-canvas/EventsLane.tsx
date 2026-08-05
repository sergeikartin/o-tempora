import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Discovery } from '../../shared/types';
import { mapDiscoveries } from './map-to-items';
import { BAR_HEIGHT, CATEGORY_COLORS, LANE_TOP_PADDING, POINT_RADIUS, ROW_PITCH } from './options';
import styles from './EventsLane.module.css';

interface PointLayout {
  id: string;
  name: string;
  x: number;
  fill: string;
  tooltip: string;
}

const SINGLE_ROW_Y = LANE_TOP_PADDING;

interface EventsLaneProps {
  discoveries: Discovery[];
  xScale: d3.ScaleLinear<number, number>;
}

// Simplest of the three lanes: discoveries.json is always single-year, so
// every entry is a point, and the dataset (24 items) is small enough that no
// row-stacking algorithm is needed — everything renders on one row.
export function EventsLane({ discoveries, xScale }: EventsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapDiscoveries(discoveries), [discoveries]);
  const totalHeight = ROW_PITCH + LANE_TOP_PADDING;
  const totalWidth = xScale.range()[1] ?? 0;

  const layout: PointLayout[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        x: xScale(item.startYear),
        fill: CATEGORY_COLORS[item.category],
        tooltip: item.tooltip,
      })),
    [items, xScale],
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
        const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        dot.append('title');
        g.append('text').attr('class', `d3-point-name ${styles.pointName}`).attr('dominant-baseline', 'middle');
        return g;
      });

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', SINGLE_ROW_Y + BAR_HEIGHT / 2)
      .attr('fill', (d) => d.fill);

    pointGroups.select('.d3-dot title').text((d) => d.tooltip);

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x + POINT_RADIUS + 4)
      .attr('y', SINGLE_ROW_Y + BAR_HEIGHT / 2)
      .text((d) => d.name);
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="points" />
    </svg>
  );
}
