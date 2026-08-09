import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Discovery } from '../../shared/types';
import { assignRows, mapDiscoveries } from './map-to-items';
import {
  DISCOVERY_CATEGORY_COLORS,
  EVENTS_LABEL_LINE_HEIGHT_PX,
  EVENTS_LABEL_MAX_WIDTH_PX,
  EVENTS_MARKER_LABEL_GAP,
  LANE_TOP_PADDING,
  MIN_ROW_GAP_PX,
  POINT_RADIUS,
  ROW_GAP,
  estimateLabelWidthPx,
  wrapLabelLines,
} from './options';
import styles from './EventsLane.module.css';

interface PointLayout {
  id: string;
  lines: string[];
  x: number;
  markerY: number;
  labelY: number;
  fill: string;
}

interface EventsLaneProps {
  discoveries: Discovery[];
  xScale: d3.ScaleLinear<number, number>;
}

// discoveries.json is always single-year, so every entry is a point. A
// label wraps across multiple lines (wrapLabelLines, bounded to
// EVENTS_LABEL_MAX_WIDTH_PX) rather than staying on one line, so two things
// change from the single-line lanes: row-collision extents use each label's
// (now much narrower, bounded) wrapped width instead of its full-name
// width, and each row's vertical pitch — for both its marker and its label,
// which move down together — is computed from the tallest label actually
// assigned to it, rather than a fixed MARKER_ROW_PITCH, so a multi-line
// label can never bleed into the row below it. See rowLayoutByRow below.
export function EventsLane({ discoveries, xScale }: EventsLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapDiscoveries(discoveries), [discoveries]);
  const linesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      map.set(item.id, wrapLabelLines(item.name, EVENTS_LABEL_MAX_WIDTH_PX));
    }
    return map;
  }, [items]);

  const rowOfItem = useMemo(() => {
    const labelExtents = items.map((item) => {
      const x = xScale(item.startYear);
      const lines = linesById.get(item.id) ?? [item.name];
      const labelHalf = Math.max(...lines.map((line) => estimateLabelWidthPx(line))) / 2;
      return {
        id: item.id,
        startYear: Math.min(x - POINT_RADIUS, x - labelHalf),
        endYear: Math.max(x + POINT_RADIUS, x + labelHalf),
      };
    });
    return assignRows(labelExtents, MIN_ROW_GAP_PX);
  }, [items, linesById, xScale]);

  const rowLayoutByRow = useMemo(() => {
    const maxLinesByRow: number[] = [];
    for (const item of items) {
      const row = rowOfItem.get(item.id) ?? 0;
      const lineCount = (linesById.get(item.id) ?? [item.name]).length;
      maxLinesByRow[row] = Math.max(maxLinesByRow[row] ?? 0, lineCount);
    }
    const markerYs: number[] = [];
    const labelStarts: number[] = [];
    let y = LANE_TOP_PADDING + POINT_RADIUS; // marker center for row 0
    for (let row = 0; row < maxLinesByRow.length; row += 1) {
      markerYs[row] = y;
      const labelY = y + POINT_RADIUS + EVENTS_MARKER_LABEL_GAP;
      labelStarts[row] = labelY;
      y = labelY + (maxLinesByRow[row] ?? 1) * EVENTS_LABEL_LINE_HEIGHT_PX + ROW_GAP + POINT_RADIUS;
    }
    return { markerYs, labelStarts, totalHeight: y - POINT_RADIUS };
  }, [items, linesById, rowOfItem]);

  const totalHeight = rowLayoutByRow.totalHeight;
  const totalWidth = xScale.range()[1] ?? 0;

  const layout: PointLayout[] = useMemo(
    () =>
      items.map((item) => {
        const row = rowOfItem.get(item.id) ?? 0;
        return {
          id: item.id,
          lines: linesById.get(item.id) ?? [item.name],
          x: xScale(item.startYear),
          markerY: rowLayoutByRow.markerYs[row] ?? LANE_TOP_PADDING + POINT_RADIUS,
          labelY: rowLayoutByRow.labelStarts[row] ?? LANE_TOP_PADDING + POINT_RADIUS * 2 + EVENTS_MARKER_LABEL_GAP,
          fill: DISCOVERY_CATEGORY_COLORS[item.category],
        };
      }),
    [items, linesById, rowOfItem, rowLayoutByRow, xScale],
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
        g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
        g.append('text')
          .attr('class', `d3-point-name ${styles.pointName}`)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'hanging');
        return g;
      });

    pointGroups
      .select<SVGCircleElement>('.d3-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.markerY)
      .attr('fill', (d) => d.fill)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'discovery');

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.labelY)
      .attr('fill', (d) => d.fill)
      // Same delegated-click wiring as the dot above, so the label is an
      // equally valid click target for opening the detail drawer.
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'discovery')
      .each(function renderLines(d) {
        // A trailing space on every non-final tspan reproduces the original
        // single-space-separated name in the rendered text's textContent —
        // invisible on screen, but keeps DOM inspection/testing matching
        // the source name exactly.
        d3.select(this)
          .selectAll<SVGTSpanElement, string>('tspan')
          .data(d.lines)
          .join('tspan')
          .attr('x', d.x)
          .attr('dy', (_line, i) => (i === 0 ? 0 : EVENTS_LABEL_LINE_HEIGHT_PX))
          .text((line, i) => (i < d.lines.length - 1 ? `${line} ` : line));
      });
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="points" />
    </svg>
  );
}
