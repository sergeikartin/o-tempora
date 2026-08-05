import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Discovery } from '../../shared/types';
import { assignRows, mapDiscoveries } from './map-to-items';
import { BAR_HEIGHT, CATEGORY_COLORS, LANE_TOP_PADDING, POINT_RADIUS, ROW_PITCH } from './options';
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

// Rough per-character estimate for the 11px label font, good enough to keep
// nearby points from overlapping without a real DOM text-measurement pass.
const AVG_CHAR_WIDTH_PX = 6;
const LABEL_START_OFFSET_PX = POINT_RADIUS + 4;
// Much smaller than MIN_ROW_GAP_YEARS's default gap since this is real
// screen pixels, not years — just enough breathing room between two labels.
const MIN_ROW_GAP_PX = 8;

// discoveries.json is always single-year, so every entry is a point — but
// with 24+ items and long names, points can cluster close enough in pixels
// (even years apart, at low zoom) for labels to overlap, so points still
// need row-stacking. There's no year-range to stack on (unlike People/Wars),
// so this stacks on each point's estimated label pixel-extent instead.
export function EventsLane({ discoveries, xScale }: EventsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapDiscoveries(discoveries), [discoveries]);
  const rowOfItem = useMemo(() => {
    const labelExtents = items.map((item) => {
      const x = xScale(item.startYear);
      return { id: item.id, startYear: x, endYear: x + LABEL_START_OFFSET_PX + item.name.length * AVG_CHAR_WIDTH_PX };
    });
    return assignRows(labelExtents, MIN_ROW_GAP_PX);
  }, [items, xScale]);
  const rowCount = rowOfItem.size > 0 ? Math.max(...rowOfItem.values()) + 1 : 0;
  const totalHeight = rowCount * ROW_PITCH + LANE_TOP_PADDING;
  const totalWidth = xScale.range()[1] ?? 0;

  const layout: PointLayout[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        x: xScale(item.startYear),
        y: LANE_TOP_PADDING + (rowOfItem.get(item.id) ?? 0) * ROW_PITCH,
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
        const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        dot.append('title');
        g.append('text').attr('class', `d3-point-name ${styles.pointName}`).attr('dominant-baseline', 'middle');
        return g;
      });

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
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="points" />
    </svg>
  );
}
