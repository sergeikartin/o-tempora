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
import { buildRangeAndPointLayout, type PointLayout } from './map-to-items';
import { attachMarkJoin, toggleSelectionHighlight } from './mark-join';
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
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
  type ZoomAnimationHandle,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
} from './options';

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
  // The currently-selected entity's id (DetailPanel is open for it), or null
  // — see PeopleLane's identical prop for the shared rationale.
  selectedId?: string | null;
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
// memo: see PeopleLane's identical comment — TimelineCanvas re-renders every
// rAF tick while scrolling, but none of this component's props change from
// that.
const ConflictsMilestonesLaneImpl = forwardRef<
  ZoomAnimationHandle,
  ConflictsMilestonesLaneProps
>(function ConflictsMilestonesLane(
  { conflicts, milestones, xScale, eventsRowFor, selectedId },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Caches the zoom tick loop's own selectAll (see applyZoomTransform below)
  // across an entire gesture's worth of rAF frames — invalidated (set null)
  // by the join effect below, the only place marks are created/destroyed, so
  // a stale cache never outlives the DOM nodes it points at.
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

  // Frozen at mount — see PeopleLane's identical initialPeopleHtmlProp
  // comment for the full rationale, including why the whole `{ __html }`
  // object (not just the string) has to be frozen: a fresh object literal
  // in the JSX below on every render makes React re-apply
  // dangerouslySetInnerHTML on every re-render (a new reference, even with
  // the same string), stomping every D3 update since mount.
  const [initialRangesHtmlProp] = useState(() => ({
    __html: renderRangesMarkupHtml(rangeLayout, styles),
  }));
  const [initialPointsHtmlProp] = useState(() => ({
    __html: renderPointsMarkupHtml(pointLayout, styles),
  }));

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
    svg
      .select('g.zoomGroup')
      .attr('transform', null)
      .style('will-change', null);
    svg
      .selectAll(
        '.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot, .d3-dot-ring-outer, .d3-dot-ring-gap',
      )
      .attr('transform', null);
    zoomTargetsSelectionRef.current = null;

    // g.ranges's real children are already there before this effect's first
    // run — rendered by the initialRangesHtml dangerouslySetInnerHTML below,
    // on both server and client — but carry no bound data yet; attachMarkJoin
    // seeds it from each node's own data-entity-id before its keyed join, so
    // it adopts them as `update` instead of tearing them down and fading in
    // a fresh `enter`. A range's label sits below its marker line (hit rect
    // grows down from markerY), the opposite of PeopleLane's lifespan lines
    // — see LineMarkGeometry's own comment for why this varies per mark
    // kind.
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
          MILESTONES_LABEL_LINE_HEIGHT_PX -
          (d.markerY - PERIOD_LINE_HEIGHT / 2) +
          HIT_AREA_PADDING_PX * 2,
        centerY: (d) => d.markerY,
        labelX: (d) => (d.x1 + d.x2) / 2,
        entityType: (d) => d.kind,
      },
    );
    // data-row is only a test hook (ConflictsMilestonesLane.test.tsx) — not
    // part of attachMarkJoin's generic contract, so it's set here rather
    // than threaded through as another geometry accessor.
    rangeGroups.attr('data-row', (d) => d.row);

    // g.points's real children are already there before this effect's first
    // run — rendered by the initialPointsHtml dangerouslySetInnerHTML below,
    // on both server and client — but carry no bound data yet; seed it from
    // their own data-entity-id before the keyed join below, so it adopts
    // them as `update` instead of tearing them down and fading in a fresh
    // `enter`.
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
          // Children built from POINT_MARK_SHAPE, in its declared order —
          // see mark-shape.ts's own comments and the range mark above for
          // why each is shaped the way it is.
          const [hit, dotRingOuter, dotRingGap, dot, name] = buildMarkChildren(
            g,
            POINT_MARK_SHAPE,
            styles,
          );
          // A brand-new mark starts already at its target row — only a
          // pre-existing mark's row *change* animates (below), via the
          // shift transition on pointGroups; an entering mark should just
          // fade in, not also slide in from row 0.
          hit
            .attr('y', (d) => d.markerY - POINT_RADIUS - HIT_AREA_PADDING_PX)
            .attr(
              'height',
              (d) =>
                d.labelY +
                d.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX -
                (d.markerY - POINT_RADIUS) +
                HIT_AREA_PADDING_PX * 2,
            );
          dotRingOuter.attr('cy', (d) => d.markerY);
          dotRingGap.attr('cy', (d) => d.markerY);
          dot.attr('cy', (d) => d.markerY);
          name.attr('y', (d) => d.labelY);
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
          d.labelY +
          d.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX -
          (d.markerY - POINT_RADIUS) +
          HIT_AREA_PADDING_PX * 2,
      );

    // The ring/gap circles only need cx/cy kept in sync with the real dot
    // (their r is fixed at creation). They're pointer-events: none
    // (ConflictsMilestonesLane.module.css) so carrying the same
    // data-entity-id as the real dot never makes them a click/hover target
    // — it's only there so the selection effect below can find them by the
    // same selector pattern every other mark uses.
    pointGroups
      .select<SVGCircleElement>('.d3-dot-ring-outer')
      .attr('cx', (d) => d.x)
      .attr('data-entity-id', (d) => d.id)
      .transition()
      .duration(durationMs)
      .attr('cy', (d) => d.markerY);

    pointGroups
      .select<SVGCircleElement>('.d3-dot-ring-gap')
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
          .attr('dy', (_line, i) =>
            i === 0 ? 0 : MILESTONES_LABEL_LINE_HEIGHT_PX,
          )
          .text((line, i) => (i < d.lines.length - 1 ? `${line} ` : line));
      })
      .transition()
      .duration(durationMs)
      .attr('y', (d) => d.labelY);
  }, [rangeLayout, pointLayout]);

  // A plain DOM class toggle, decoupled from the joins above (their
  // enter/update/exit selections aren't touched) — see PeopleLane's
  // identical effect for the shared rationale. The ring/gap lines plus the
  // real .d3-line (a range's selection outline and its own
  // grow-to-hover-size), the ring/gap circles plus the real .d3-dot (same,
  // for a point), and .d3-range-name/.d3-point-name (either mark's label)
  // get different classes — see ConflictsMilestonesLane.module.css's
  // .searchHighlight/.searchHighlightLabel for why the outline can't just
  // apply to all three.
  useLayoutEffect(() => {
    if (!svgRef.current) return;
    // The classes always exist in the compiled CSS module — the indexed
    // access only reads as possibly-undefined because of
    // noUncheckedIndexedAccess, not because they might really be missing.
    toggleSelectionHighlight(
      svgRef.current,
      '.d3-line-ring-outer[data-entity-id], .d3-line-ring-gap[data-entity-id], .d3-line[data-entity-id], .d3-dot-ring-outer[data-entity-id], .d3-dot-ring-gap[data-entity-id], .d3-dot[data-entity-id]',
      '.d3-range-name[data-entity-id], .d3-point-name[data-entity-id]',
      selectedId,
      styles.searchHighlight as string,
      styles.searchHighlightLabel as string,
    );
  }, [selectedId]);

  // TimelineCanvas's single rAF driver calls this every animation-frame
  // tick, once per lane/axis — see options.ts's ZoomAnimationTransform
  // comment for the mechanism. The marks' data is already bound to their DOM
  // nodes from the joins above, so re-selecting picks it back up for free —
  // but a fresh selectAll DOM query every tick is still wasted work across a
  // gesture's worth of frames, so it's queried once and cached in
  // zoomTargetsSelectionRef until the join effect invalidates it.
  useImperativeHandle(
    ref,
    () => ({
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
          '.d3-range-name-zoom, .d3-point-name-zoom, .d3-dot, .d3-dot-ring-outer, .d3-dot-ring-gap',
        );
        zoomTargetsSelectionRef.current.attr(
          'transform',
          zoomAnimationCounterScaleAttr(transform.sx),
        );
      },
    }),
    [],
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
