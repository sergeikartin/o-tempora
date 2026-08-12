import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { ConflictEntry, Milestone } from '../../shared/types';
import { CONFLICT_COLOR } from '../../shared/config';
import {
  assignRows,
  conflictPixelInterval,
  mapConflicts,
  mapMilestones,
  milestonePixelInterval,
} from './map-to-items';
import {
  LANE_TOP_PADDING,
  MILESTONE_CATEGORY_COLORS,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  MILESTONES_MARKER_LABEL_GAP,
  MIN_ROW_GAP_PX,
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
  ROW_GAP,
  wrapLabelLines,
} from './options';
import styles from './ConflictsMilestonesLane.module.css';

interface RangeLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  row: number;
  markerY: number;
  labelY: number;
  fill: string;
  kind: 'conflict' | 'milestone';
}

interface PointLayout {
  id: string;
  lines: string[];
  x: number;
  row: number;
  markerY: number;
  labelY: number;
  fill: string;
  kind: 'conflict' | 'milestone';
}

interface ConflictsMilestonesLaneProps {
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  xScale: d3.ScaleLinear<number, number>;
}

// Conflicts and Milestones share one below-marker row-stacking pass — the
// "mixed" lane's whole point (grill-with-docs session, 2026-08-11): a
// Conflict and a Milestone with similar fame/time can land in the same row,
// not just the same scroll region. That's sound because Conflicts and
// Milestones already share one 0-100 fame scale (ADR 0010's blended
// sitelinks+pageviews score), unlike People's separate raw-HPI scale, so
// comparing fameScore directly across the two lanes is meaningful.
// assignRows hands back row 0 as the most-famous-heavy row, which already
// sits at this lane's own top — the edge next to the shared Year Axis above
// it — so, unlike PeopleLane, no row-index inversion is needed here.
//
// A range renders as a rounded-cap line, a point (Conflict or Milestone) as
// a dot — the same Period-vs-PointInTime shape rule every lane uses, and,
// as of period-shaped Milestones (grill-with-docs session, 2026-08-12), the
// rule that decides *within* Milestones too: a period-shaped Milestone (e.g.
// the Black Death) lands in rangeLayout and renders with the exact same
// rounded-cap-line treatment a Conflict period gets — no distinct visual
// style for "this range is an era, not a war". Conflicts render in one flat
// color (CONFLICT_COLOR); Milestones keep their own category palette either
// way — color, not shape, is what tells a Conflict marker apart from a
// Milestone one now that they can share a row.
export function ConflictsMilestonesLane({ conflicts, milestones, xScale }: ConflictsMilestonesLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const conflictItems = useMemo(() => mapConflicts(conflicts), [conflicts]);
  const milestoneItems = useMemo(() => mapMilestones(milestones), [milestones]);

  const milestoneLinesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of milestoneItems) {
      map.set(item.id, wrapLabelLines(item.name, MILESTONES_LABEL_MAX_WIDTH_PX));
    }
    return map;
  }, [milestoneItems]);

  const rowOfId = useMemo(() => {
    const conflictExtents = conflictItems.map((item) => {
      const { start, end } = conflictPixelInterval(item, xScale);
      return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
    });
    const milestoneExtents = milestoneItems.map((item) => {
      const lines = milestoneLinesById.get(item.id) ?? [item.name];
      const { start, end } = milestonePixelInterval(item, lines, xScale);
      return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
    });
    return assignRows([...conflictExtents, ...milestoneExtents], MIN_ROW_GAP_PX);
  }, [conflictItems, milestoneItems, milestoneLinesById, xScale]);

  // Row height is dynamic — the tallest label actually assigned to a row
  // (a wrapped multi-line Milestone label, or a single-line Conflict label)
  // sets that row's pitch, so a multi-line label never bleeds into the row
  // below it.
  const rowLayout = useMemo(() => {
    const maxLinesByRow: number[] = [];
    const noteRow = (row: number, lineCount: number) => {
      maxLinesByRow[row] = Math.max(maxLinesByRow[row] ?? 0, lineCount);
    };
    for (const item of conflictItems) noteRow(rowOfId.get(item.id) ?? 0, 1);
    for (const item of milestoneItems) {
      // Range-shaped Milestones render a single-line label like a Conflict
      // range does — only point-shaped Milestones wrap onto multiple lines.
      if (!item.isPoint) {
        noteRow(rowOfId.get(item.id) ?? 0, 1);
        continue;
      }
      const lines = milestoneLinesById.get(item.id) ?? [item.name];
      noteRow(rowOfId.get(item.id) ?? 0, lines.length);
    }
    const markerYs: number[] = [];
    const labelStarts: number[] = [];
    let y = LANE_TOP_PADDING + POINT_RADIUS; // marker center for row 0
    for (let row = 0; row < maxLinesByRow.length; row += 1) {
      markerYs[row] = y;
      const labelY = y + POINT_RADIUS + MILESTONES_MARKER_LABEL_GAP;
      labelStarts[row] = labelY;
      y = labelY + (maxLinesByRow[row] ?? 1) * MILESTONES_LABEL_LINE_HEIGHT_PX + ROW_GAP + POINT_RADIUS;
    }
    return { markerYs, labelStarts, totalHeight: y - POINT_RADIUS };
  }, [conflictItems, milestoneItems, milestoneLinesById, rowOfId]);

  const totalHeight = rowLayout.totalHeight;
  const totalWidth = xScale.range()[1] ?? 0;
  const fallbackMarkerY = LANE_TOP_PADDING + POINT_RADIUS;
  const fallbackLabelY = fallbackMarkerY + POINT_RADIUS + MILESTONES_MARKER_LABEL_GAP;

  const rangeLayout: RangeLayout[] = useMemo(() => {
    const conflictRanges: RangeLayout[] = conflictItems
      .filter((item) => !item.isPoint)
      .map((item) => {
        const row = rowOfId.get(item.id) ?? 0;
        return {
          id: item.id,
          name: item.name,
          x1: xScale(item.startYear),
          x2: xScale(item.endYear),
          row,
          markerY: rowLayout.markerYs[row] ?? fallbackMarkerY,
          labelY: rowLayout.labelStarts[row] ?? fallbackLabelY,
          fill: CONFLICT_COLOR,
          kind: 'conflict' as const,
        };
      });
    const milestoneRanges: RangeLayout[] = milestoneItems
      .filter((item) => !item.isPoint)
      .map((item) => {
        const row = rowOfId.get(item.id) ?? 0;
        return {
          id: item.id,
          name: item.name,
          x1: xScale(item.startYear),
          x2: xScale(item.endYear),
          row,
          markerY: rowLayout.markerYs[row] ?? fallbackMarkerY,
          labelY: rowLayout.labelStarts[row] ?? fallbackLabelY,
          fill: MILESTONE_CATEGORY_COLORS[item.category],
          kind: 'milestone' as const,
        };
      });
    return [...conflictRanges, ...milestoneRanges];
  }, [conflictItems, milestoneItems, rowOfId, rowLayout, xScale, fallbackMarkerY, fallbackLabelY]);

  const pointLayout: PointLayout[] = useMemo(() => {
    const conflictPoints: PointLayout[] = conflictItems
      .filter((item) => item.isPoint)
      .map((item) => {
        const row = rowOfId.get(item.id) ?? 0;
        return {
          id: item.id,
          lines: [item.name],
          x: xScale(item.startYear),
          row,
          markerY: rowLayout.markerYs[row] ?? fallbackMarkerY,
          labelY: rowLayout.labelStarts[row] ?? fallbackLabelY,
          fill: CONFLICT_COLOR,
          kind: 'conflict' as const,
        };
      });
    const milestonePoints: PointLayout[] = milestoneItems
      .filter((item) => item.isPoint)
      .map((item) => {
        const row = rowOfId.get(item.id) ?? 0;
        return {
          id: item.id,
          lines: milestoneLinesById.get(item.id) ?? [item.name],
          x: xScale(item.startYear),
          row,
          markerY: rowLayout.markerYs[row] ?? fallbackMarkerY,
          labelY: rowLayout.labelStarts[row] ?? fallbackLabelY,
          fill: MILESTONE_CATEGORY_COLORS[item.category],
          kind: 'milestone' as const,
        };
      });
    return [...conflictPoints, ...milestonePoints];
  }, [conflictItems, milestoneItems, milestoneLinesById, rowOfId, rowLayout, xScale, fallbackMarkerY, fallbackLabelY]);

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
      .attr('y1', (d) => d.markerY)
      .attr('y2', (d) => d.markerY)
      .attr('stroke', (d) => d.fill)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind);

    rangeGroups
      .select<SVGTextElement>('.d3-range-name')
      .attr('x', (d) => (d.x1 + d.x2) / 2)
      .attr('y', (d) => d.labelY)
      .attr('fill', (d) => d.fill)
      // Same delegated-click wiring as the line above, so the label is an
      // equally valid click target for opening the detail drawer.
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind)
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
      .attr('cy', (d) => d.markerY)
      .attr('fill', (d) => d.fill)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind);

    pointGroups
      .select<SVGTextElement>('.d3-point-name')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.labelY)
      .attr('fill', (d) => d.fill)
      // Same delegated-click wiring as the dot above, so the label is an
      // equally valid click target for opening the detail drawer.
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind)
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
          .attr('dy', (_line, i) => (i === 0 ? 0 : MILESTONES_LABEL_LINE_HEIGHT_PX))
          .text((line, i) => (i < d.lines.length - 1 ? `${line} ` : line));
      });
  }, [rangeLayout, pointLayout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="ranges" />
      <g className="points" />
    </svg>
  );
}
