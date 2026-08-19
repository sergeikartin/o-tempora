import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { ConflictEntry, Milestone } from '../../shared/types';
import { CONFLICT_COLOR } from '../../shared/config';
import { motionDurationMs } from '../../shared/lib/motion';
import { conflictPixelInterval, mapConflicts, mapMilestones, milestonePixelInterval } from './map-to-items';
import {
  HIT_AREA_PADDING_PX,
  LANE_TOP_PADDING,
  MILESTONE_CATEGORY_COLORS,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  MILESTONES_LABEL_MAX_WIDTH_PX,
  MILESTONES_MARKER_LABEL_GAP,
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
  ROW_GAP,
  wrapLabelLines,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
  type ZoomAnimationHandle,
} from './options';
import styles from './ConflictsMilestonesLane.module.css';

interface RangeLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX1: number;
  hitX2: number;
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
  hitX1: number;
  hitX2: number;
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
  // Resolves this lane's currently-visible ids to their Row Depth — backed
  // by a permanent row identity computed once against the full (unfiltered)
  // datasets (see map-to-items.ts's computeRowAssignment), so a row stays
  // stable across every filter/zoom change instead of being re-derived from
  // whatever's currently visible.
  eventsRowFor: (ids: string[]) => Map<string, number>;
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
export const ConflictsMilestonesLane = forwardRef<ZoomAnimationHandle, ConflictsMilestonesLaneProps>(
  function ConflictsMilestonesLane({ conflicts, milestones, xScale, eventsRowFor }, ref) {
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

    const rowOfId = useMemo(
      () => eventsRowFor([...conflictItems.map((item) => item.id), ...milestoneItems.map((item) => item.id)]),
      [conflictItems, milestoneItems, eventsRowFor],
    );

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
          const { start: hitX1, end: hitX2 } = conflictPixelInterval(item, xScale);
          return {
            id: item.id,
            name: item.name,
            x1: xScale(item.startYear),
            x2: xScale(item.endYear),
            hitX1,
            hitX2,
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
          // lines is only read on the point branch, which this (range) item
          // never takes — see milestonePixelInterval.
          const { start: hitX1, end: hitX2 } = milestonePixelInterval(item, [], xScale);
          return {
            id: item.id,
            name: item.name,
            x1: xScale(item.startYear),
            x2: xScale(item.endYear),
            hitX1,
            hitX2,
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
          const { start: hitX1, end: hitX2 } = conflictPixelInterval(item, xScale);
          return {
            id: item.id,
            lines: [item.name],
            x: xScale(item.startYear),
            hitX1,
            hitX2,
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
          const lines = milestoneLinesById.get(item.id) ?? [item.name];
          const { start: hitX1, end: hitX2 } = milestonePixelInterval(item, lines, xScale);
          return {
            id: item.id,
            lines,
            x: xScale(item.startYear),
            hitX1,
            hitX2,
            row,
            markerY: rowLayout.markerYs[row] ?? fallbackMarkerY,
            labelY: rowLayout.labelStarts[row] ?? fallbackLabelY,
            fill: MILESTONE_CATEGORY_COLORS[item.category],
            kind: 'milestone' as const,
          };
        });
      return [...conflictPoints, ...milestonePoints];
    }, [conflictItems, milestoneItems, milestoneLinesById, rowOfId, rowLayout, xScale, fallbackMarkerY, fallbackLabelY]);

    // useLayoutEffect, not useEffect — see PeopleLane's identical comment: a
    // deferred passive effect shows one stale frame when xScale changes in
    // the same commit.
    useLayoutEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const durationMs = motionDurationMs('--motion-duration-base');

      // A zoom animation's rAF loop (see the imperative handle below) writes
      // a transform straight to g.zoomGroup and every label/dot every tick,
      // without going through React — reset it here, in the same effect that
      // lands the real geometry for a new xScale, so the commit is atomic
      // (see PeopleLane's identical comment for why).
      svg.select('g.zoomGroup').attr('transform', null);
      svg.selectAll('.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot').attr('transform', null);

      const rangeGroups = svg
        .select<SVGGElement>('g.ranges')
        .selectAll<SVGGElement, RangeLayout>('g.d3-range')
        .data(rangeLayout, (d) => d.id)
        .join(
          (enter) => {
            const g = enter.append('g').attr('class', 'd3-range').style('opacity', 0);
            // Invisible, oversized rect behind the line/label — see
            // PeopleLane's identical .d3-hit for why (thin line + a
            // separately-clickable label below it are both poor, gapped hit
            // targets on their own).
            const hit = g.append('rect').attr('class', `d3-hit ${styles.hitArea}`);
            const line = g
              .append('line')
              .attr('class', `d3-line ${styles.line}`)
              .attr('stroke-width', PERIOD_LINE_HEIGHT)
              .attr('stroke-linecap', 'round');
            // Wrapped in its own <g> (a literal marker class, not styled
            // itself) so the zoom-animation counter-scale below can target
            // that wrapper instead of .d3-range-name directly — see
            // PeopleLane's identical .d3-name-zoom comment for why: .label
            // has its own `transition: transform` for the hover-grow
            // effect, which would otherwise fight the counter-scale's own
            // per-frame writes to the same CSS property.
            const name = g
              .append('g')
              .attr('class', 'd3-range-name-zoom')
              .append('text')
              .attr('class', `d3-range-name ${styles.label}`)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'hanging');
            // A brand-new mark starts already at its target row — only a
            // pre-existing mark's row *change* animates (below), via the
            // shift transition on rangeGroups; an entering mark should just
            // fade in, not also slide in from row 0.
            hit
              .attr('y', (d) => d.markerY - PERIOD_LINE_HEIGHT / 2 - HIT_AREA_PADDING_PX)
              .attr(
                'height',
                (d) =>
                  d.labelY + MILESTONES_LABEL_LINE_HEIGHT_PX - (d.markerY - PERIOD_LINE_HEIGHT / 2) + HIT_AREA_PADDING_PX * 2,
              );
            line.attr('y1', (d) => d.markerY).attr('y2', (d) => d.markerY);
            name.attr('y', (d) => d.labelY);
            g.transition().duration(durationMs).style('opacity', 1);
            return g;
          },
          (update) => update,
          (exit) =>
            exit.style('pointer-events', 'none').transition().duration(durationMs).style('opacity', 0).remove(),
        );

      rangeGroups.attr('data-row', (d) => d.row);

      // x/fill/data-* attrs apply instantly — only a row change (the y-driven
      // attrs below) animates. An entering mark already has these set (above),
      // so re-setting them here is a no-op for it and a live update for one
      // that was already on screen.
      rangeGroups
        .select<SVGRectElement>('.d3-hit')
        .attr('x', (d) => d.hitX1 - HIT_AREA_PADDING_PX)
        .attr('width', (d) => d.hitX2 - d.hitX1 + HIT_AREA_PADDING_PX * 2)
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', (d) => d.kind)
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.markerY - PERIOD_LINE_HEIGHT / 2 - HIT_AREA_PADDING_PX)
        .attr(
          'height',
          (d) => d.labelY + MILESTONES_LABEL_LINE_HEIGHT_PX - (d.markerY - PERIOD_LINE_HEIGHT / 2) + HIT_AREA_PADDING_PX * 2,
        );

      rangeGroups
        .select<SVGLineElement>('.d3-line')
        .attr('x1', (d) => d.x1)
        .attr('x2', (d) => d.x2)
        .attr('stroke', (d) => d.fill)
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', (d) => d.kind)
        .transition()
        .duration(durationMs)
        .attr('y1', (d) => d.markerY)
        .attr('y2', (d) => d.markerY);

      rangeGroups
        .select<SVGTextElement>('.d3-range-name')
        .attr('x', (d) => (d.x1 + d.x2) / 2)
        .attr('fill', (d) => d.fill)
        // Same delegated-click wiring as the line above, so the label is an
        // equally valid click target for opening the detail drawer.
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', (d) => d.kind)
        .text((d) => d.name)
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.labelY);

      const pointGroups = svg
        .select<SVGGElement>('g.points')
        .selectAll<SVGGElement, PointLayout>('g.d3-point-group')
        .data(pointLayout, (d) => d.id)
        .join(
          (enter) => {
            const g = enter.append('g').attr('class', 'd3-point-group').style('opacity', 0);
            // Invisible, oversized rect behind the dot/label — see
            // PeopleLane's identical .d3-hit for why.
            const hit = g.append('rect').attr('class', `d3-hit ${styles.hitArea}`);
            const dot = g.append('circle').attr('class', `d3-dot ${styles.dot}`).attr('r', POINT_RADIUS);
            // Wrapped in its own <g> — see the identical d3-range-name-zoom
            // comment above.
            const name = g
              .append('g')
              .attr('class', 'd3-point-name-zoom')
              .append('text')
              .attr('class', `d3-point-name ${styles.label}`)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'hanging');
            // A brand-new mark starts already at its target row — only a
            // pre-existing mark's row *change* animates (below), via the
            // shift transition on pointGroups; an entering mark should just
            // fade in, not also slide in from row 0.
            hit
              .attr('y', (d) => d.markerY - POINT_RADIUS - HIT_AREA_PADDING_PX)
              .attr(
                'height',
                (d) =>
                  d.labelY + d.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX - (d.markerY - POINT_RADIUS) + HIT_AREA_PADDING_PX * 2,
              );
            dot.attr('cy', (d) => d.markerY);
            name.attr('y', (d) => d.labelY);
            g.transition().duration(durationMs).style('opacity', 1);
            return g;
          },
          (update) => update,
          (exit) =>
            exit.style('pointer-events', 'none').transition().duration(durationMs).style('opacity', 0).remove(),
        );

      pointGroups.attr('data-row', (d) => d.row);

      // x/fill/data-* attrs apply instantly — only a row change (the y-driven
      // attrs below) animates. An entering mark already has these set (above),
      // so re-setting them here is a no-op for it and a live update for one
      // that was already on screen.
      pointGroups
        .select<SVGRectElement>('.d3-hit')
        .attr('x', (d) => d.hitX1 - HIT_AREA_PADDING_PX)
        .attr('width', (d) => d.hitX2 - d.hitX1 + HIT_AREA_PADDING_PX * 2)
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', (d) => d.kind)
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.markerY - POINT_RADIUS - HIT_AREA_PADDING_PX)
        .attr(
          'height',
          (d) =>
            d.labelY + d.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX - (d.markerY - POINT_RADIUS) + HIT_AREA_PADDING_PX * 2,
        );

      pointGroups
        .select<SVGCircleElement>('.d3-dot')
        .attr('cx', (d) => d.x)
        .attr('fill', (d) => d.fill)
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', (d) => d.kind)
        .transition()
        .duration(durationMs)
        .attr('cy', (d) => d.markerY);

      pointGroups
        .select<SVGTextElement>('.d3-point-name')
        .attr('x', (d) => d.x)
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
        })
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.labelY);
    }, [rangeLayout, pointLayout]);

    // TimelineCanvas's single rAF driver calls this every animation-frame
    // tick, once per lane/axis — see options.ts's ZoomAnimationTransform
    // comment for the mechanism. A plain D3 re-select (not a ref/cache of the
    // layout arrays): the marks' data is already bound to their DOM nodes
    // from the joins above, so re-selecting picks it back up for free.
    useImperativeHandle(
      ref,
      () => ({
        applyZoomTransform(transform) {
          if (!svgRef.current) return;
          const svg = d3.select(svgRef.current);
          svg.select('g.zoomGroup').attr('transform', zoomAnimationGroupTransformAttr(transform));
          svg
            .selectAll('.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot')
            .attr('transform', zoomAnimationCounterScaleAttr(transform.sx));
        },
      }),
      [],
    );

    return (
      <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
        <g className="zoomGroup">
          <g className="ranges" />
          <g className="points" />
        </g>
      </svg>
    );
  },
);
