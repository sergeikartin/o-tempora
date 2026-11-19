import * as d3 from 'd3';
import {
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motionDurationMs } from '../../shared/lib/motion';
import { m } from '../../shared/paraglide/messages.js';
import type { ConflictEntry, Milestone } from '../../shared/types';
import styles from './ConflictsMilestonesLane.module.css';
import {
  buildRangeAndPointLayout,
  type PointLayout,
  pinnedLabelX,
  type RangeLayout,
} from './map-to-items';
import {
  attachMarkJoin,
  ensureHaloChild,
  toggleSelectionHighlight,
} from './mark-join';
import {
  buildMarkChildren,
  POINT_MARK_SHAPE,
  RANGE_MARK_SHAPE,
  seedPrerenderedData,
} from './mark-shape';
import {
  renderPointsMarkupHtml,
  renderRangesMarkupHtml,
} from './mark-shape-html';
import {
  HIT_AREA_PADDING_PX,
  type LabelPinningHandle,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  PERIOD_LINE_HEIGHT,
  POINT_LABEL_OFFSET_PX,
  pointHitHeight,
  pointHitY,
  pointLabelY,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
} from './options';
import { usePinnedLabels } from './use-pinned-labels';

interface ConflictsMilestonesLaneProps {
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  xScale: d3.ScaleLinear<number, number>;
  // Resolves visible ids to their permanent row, computed once against the full
  // unfiltered datasets (map-to-items.ts's computeRowAssignment), so rows are
  // stable across filter/zoom changes.
  eventsRowFor: (ids: string[]) => Map<string, number>;
  selectedIds?: readonly string[];
}

const NO_IDS: readonly string[] = [];

const rangeLabelSelector = (id: string) =>
  `.d3-range-name[data-entity-id="${id}"]`;
const writeRangeLabelX = (label: SVGTextElement, x: number) => {
  label.setAttribute('x', `${x}`);
  for (const line of label.querySelectorAll('tspan'))
    line.setAttribute('x', `${x}`);
};

// Conflicts and Milestones share one below-marker row-stacking pass, so a
// Conflict and a Milestone of similar fame and time can share a row. That is
// meaningful because both use one 0-100 fame scale (the blended
// sitelinks+pageviews score, packages/data-pipeline/docs/adr/0010), unlike
// People's raw HPI. Row 0, the most famous row, is already at this lane's top,
// next to the Year Axis, so unlike PeopleLane no row inversion is needed.
//
// A range renders as a rounded-cap line and a point as a dot, the shape rule
// every lane uses, including for period-shaped Milestones (e.g. the Black
// Death), which get the same line treatment as a Conflict period. Conflicts
// use one flat color (CONFLICT_COLOR); Milestones keep their category palette,
// so color, not shape, tells a Conflict from a Milestone.
// memo: see PeopleLane; none of this component's props change on scroll ticks.
const ConflictsMilestonesLaneImpl = forwardRef<
  LabelPinningHandle,
  ConflictsMilestonesLaneProps
>(function ConflictsMilestonesLane(
  { conflicts, milestones, xScale, eventsRowFor, selectedIds = NO_IDS },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Caches the zoom tick loop's selectAll across a gesture's frames; the join
  // effect invalidates it (null).
  const zoomTargetsSelectionRef = useRef<d3.Selection<
    Element,
    unknown,
    SVGSVGElement,
    unknown
  > | null>(null);

  const { rangeLayout, pointLayout, totalHeight } = useMemo(
    () => buildRangeAndPointLayout(conflicts, milestones, xScale, eventsRowFor),
    [conflicts, milestones, xScale, eventsRowFor],
  );
  const totalWidth = xScale.range()[1] ?? 0;

  const { pinLabels, setItems: setPinnedLabelItems } =
    usePinnedLabels<RangeLayout>({
      svgRef,
      labelSelector: rangeLabelSelector,
      pinnedX: pinnedLabelX,
      writeX: writeRangeLabelX,
    });

  // Frozen at mount, whole `{ __html }` object included; see PeopleLane's
  // initialPeopleHtmlProp.
  const [initialRangesHtmlProp] = useState(() => ({
    __html: renderRangesMarkupHtml(rangeLayout, styles),
  }));
  const [initialPointsHtmlProp] = useState(() => ({
    __html: renderPointsMarkupHtml(pointLayout, styles),
  }));

  // useLayoutEffect so an xScale change lands before paint (see PeopleLane).
  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const durationMs = motionDurationMs('--motion-duration-base');

    // The zoom animation's rAF loop writes transforms straight to g.zoomGroup and
    // every label/dot, bypassing React; reset them in the same effect that lands
    // the real geometry, so the commit is atomic (see PeopleLane).
    svg
      .select('g.zoomGroup')
      .attr('transform', null)
      .style('will-change', null);
    svg
      .selectAll(
        '.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot, .d3-dot-halo',
      )
      .attr('transform', null);
    zoomTargetsSelectionRef.current = null;

    // g.ranges's children already exist (rendered by initialRangesHtml) but carry
    // no bound data; attachMarkJoin seeds it from each node's data-entity-id so
    // the join adopts them as `update`. A range's label sits below its marker line
    // (hit rect grows down from markerY), the opposite of PeopleLane; see
    // LineMarkGeometry.
    const rangeGroups = attachMarkJoin(
      svgRef.current,
      { groupSelector: 'g.ranges', nodeClass: 'd3-range' },
      RANGE_MARK_SHAPE,
      styles,
      rangeLayout,
      {
        hitX1: (d) => d.hitX1,
        hitY: (d) => d.markerY - PERIOD_LINE_HEIGHT / 2 - HIT_AREA_PADDING_PX,
        hitHeight: (d) =>
          d.labelY +
          d.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX -
          (d.markerY - PERIOD_LINE_HEIGHT / 2) +
          HIT_AREA_PADDING_PX * 2,
        centerY: (d) => d.markerY,
        labelX: (d) => d.x1,
        lines: (d) => d.lines,
        entityType: (d) => d.kind,
      },
    );
    // data-row is a test hook (ConflictsMilestonesLane.test.tsx), not part of
    // attachMarkJoin's generic contract, so it is set here.
    rangeGroups.attr('data-row', (d) => d.row);

    // g.points's children already exist (rendered by initialPointsHtml) but carry
    // no bound data; seed it from data-entity-id so the join adopts them as
    // `update`.
    const pointNodes = svg
      .select<SVGGElement>('g.points')
      .selectAll<SVGGElement, PointLayout | undefined>('g.d3-point-group');
    seedPrerenderedData(pointNodes, pointLayout);
    const pointGroups = pointNodes
      .data(pointLayout, (d) => d?.id ?? '')
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'd3-point-group')
            .style('opacity', 0);
          const [hit, dotHalo, dot, name] = buildMarkChildren(
            g,
            POINT_MARK_SHAPE,
            styles,
          );
          // A new mark starts at its target row: only an existing mark's row change
          // animates (shift transition on pointGroups); an entering mark just fades in.
          hit
            .attr('y', (d) => pointHitY(d.markerY, d.lines.length))
            .attr('height', (d) => pointHitHeight(d.lines.length));
          dotHalo.attr('cy', (d) => d.markerY);
          dot.attr('cy', (d) => d.markerY);
          name.attr('y', (d) => pointLabelY(d.markerY, d.lines.length));
          g.transition().duration(durationMs).style('opacity', 1);
          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .style('pointer-events', 'none')
            .transition()
            .duration(durationMs)
            .style('opacity', 0)
            .remove(),
      );

    pointGroups.attr('data-row', (d) => d.row);

    // x/fill/data-* attrs apply instantly; only a row change (the y-driven attrs
    // below) animates. Re-setting them on an entering mark is a no-op.
    pointGroups
      .select<SVGRectElement>('.d3-hit')
      .attr('x', (d) => d.hitX1 - HIT_AREA_PADDING_PX)
      .attr('width', (d) => d.hitX2 - d.hitX1 + HIT_AREA_PADDING_PX * 2)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind)
      .transition()
      .duration(durationMs)
      .attr('y', (d) => pointHitY(d.markerY, d.lines.length))
      .attr('height', (d) => pointHitHeight(d.lines.length));

    // The halo circle only needs cx/cy synced with the real dot (r is fixed at
    // creation). It is pointer-events: none (ConflictsMilestonesLane.module.css),
    // so sharing the dot's data-entity-id doesn't make it a target; it exists so
    // the selection effect finds it by the usual selector.
    pointGroups
      .select<SVGCircleElement>('.d3-dot-halo')
      .attr('cx', (d) => d.x)
      .attr('data-entity-id', (d) => d.id)
      .transition()
      .duration(durationMs)
      .attr('cy', (d) => d.markerY);

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
      .attr('x', (d) => d.x + POINT_LABEL_OFFSET_PX)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', (d) => d.kind)
      .each(function renderLines(d) {
        // A trailing space on every non-final tspan keeps the rendered
        // textContent equal to the source name.
        d3.select(this)
          .selectAll<SVGTSpanElement, string>('tspan')
          .data(d.lines)
          .join('tspan')
          .attr('x', d.x + POINT_LABEL_OFFSET_PX)
          .attr('dy', (_line, i) =>
            i === 0 ? 0 : MILESTONES_LABEL_LINE_HEIGHT_PX,
          )
          .text((line, i) => (i < d.lines.length - 1 ? `${line} ` : line));
      })
      .transition()
      .duration(durationMs)
      .attr('y', (d) => pointLabelY(d.markerY, d.lines.length));

    setPinnedLabelItems(rangeLayout);
  }, [rangeLayout, pointLayout, setPinnedLabelItems]);

  // A DOM class toggle independent of the joins (see PeopleLane). The halo line
  // + real .d3-line (range), halo circle + real .d3-dot (point), and
  // .d3-range-name/.d3-point-name (labels) get different classes; see
  // ConflictsMilestonesLane.module.css's .searchHighlight/.searchHighlightLabel.
  useLayoutEffect(() => {
    if (!svgRef.current) return;
    for (const id of selectedIds) {
      ensureHaloChild(
        svgRef.current,
        '.d3-line',
        RANGE_MARK_SHAPE[1],
        styles,
        id,
        ['x1', 'x2', 'y1', 'y2'],
      );
      ensureHaloChild(
        svgRef.current,
        '.d3-dot',
        POINT_MARK_SHAPE[1],
        styles,
        id,
        ['cx', 'cy'],
      );
    }
    // The classes exist in the compiled CSS module; indexed access reads as
    // possibly undefined only because of noUncheckedIndexedAccess.
    toggleSelectionHighlight(
      svgRef.current,
      '.d3-line-halo[data-entity-id], .d3-line[data-entity-id], .d3-dot-halo[data-entity-id], .d3-dot[data-entity-id]',
      '.d3-range-name[data-entity-id], .d3-point-name[data-entity-id]',
      selectedIds,
      styles.searchHighlight as string,
      styles.searchHighlightLabel as string,
    );
  }, [selectedIds]);

  // Called every frame by TimelineCanvas's single rAF driver (see options.ts's
  // ZoomAnimationTransform). The selectAll is queried once and cached in
  // zoomTargetsSelectionRef until the join effect invalidates it.
  useImperativeHandle(
    ref,
    () => ({
      pinLabelsToViewport: pinLabels,
      beginZoomAnimation() {
        if (!svgRef.current) return;
        d3.select(svgRef.current)
          .select('g.zoomGroup')
          .style('will-change', 'transform');
      },
      applyZoomTransform(transform) {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg
          .select('g.zoomGroup')
          .attr('transform', zoomAnimationGroupTransformAttr(transform));
        zoomTargetsSelectionRef.current ??= svg.selectAll<Element, unknown>(
          '.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot, .d3-dot-halo',
        );
        zoomTargetsSelectionRef.current.attr(
          'transform',
          zoomAnimationCounterScaleAttr(transform.sx),
        );
      },
    }),
    [pinLabels],
  );

  return (
    <svg
      ref={svgRef}
      width={totalWidth}
      height={totalHeight}
      className={styles.svg}
      role="img"
      aria-label={m.conflictsMilestonesHeading()}
    >
      <g className="zoomGroup">
        <g
          className="ranges"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: initialRangesHtmlProp is our own pure templater's output (mark-shape-html.ts), not user input — see PeopleLane's identical initialPeopleHtmlProp comment for why this exists at all.
          dangerouslySetInnerHTML={initialRangesHtmlProp}
        />
        <g
          className="points"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: same as g.ranges above.
          dangerouslySetInnerHTML={initialPointsHtmlProp}
        />
      </g>
    </svg>
  );
});
export const ConflictsMilestonesLane = memo(ConflictsMilestonesLaneImpl);
