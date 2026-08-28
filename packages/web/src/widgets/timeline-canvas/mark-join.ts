import * as d3 from 'd3';
import { motionDurationMs } from '../../shared/lib/motion';
import {
  buildMarkChildren,
  type MarkShape,
  seedPrerenderedData,
} from './mark-shape';
import { HIT_AREA_PADDING_PX } from './options';

/**
 * The fields every line-shaped mark's layout (PersonLayout, RangeLayout)
 * carries under these exact names — the seam attachMarkJoin depends on.
 * Point's circle-shaped join has a different attribute set (cx/cy, no line
 * extent) and isn't covered by this module.
 */
export interface LineMarkDatum {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX2: number;
  labelY: number;
  fill: string;
}

/**
 * Per-mark-kind geometry attachMarkJoin can't infer from LineMarkDatum alone
 * — where the label sits relative to the line (above for a Person, below for
 * a Range/Milestone), and how far left of x1 the hit rect's left edge
 * extends when a centered label overhangs it.
 */
export interface LineMarkGeometry<Datum> {
  hitX1: (d: Datum) => number;
  hitY: (d: Datum) => number;
  hitHeight: (d: Datum) => number;
  /** Shared by the ring-outer/ring-gap/line parts — all three sit on the same vertical center. */
  centerY: (d: Datum) => number;
  labelX: (d: Datum) => number;
  entityType: (d: Datum) => string;
}

export interface MarkJoinTarget {
  /** CSS selector for the `<g>` the marks live under, e.g. `'g.people'`. */
  groupSelector: string;
  /** Literal marker class each entering mark's own `<g>` gets, e.g. `'d3-person'`. */
  nodeClass: string;
}

/**
 * Attaches (or updates) one line-shaped mark kind's D3 join — the
 * enter/update/exit lifecycle, prerendered-node adoption, and per-part attr
 * wiring shared by PeopleLane's lifespan lines and ConflictsMilestonesLane's
 * range lines. Returns the joined groups so a caller can attach any static
 * per-item attrs of its own (e.g. ConflictsMilestonesLane's `data-row`).
 */
export function attachMarkJoin<Datum extends LineMarkDatum>(
  svgEl: SVGSVGElement,
  { groupSelector, nodeClass }: MarkJoinTarget,
  shape: MarkShape,
  styles: Record<string, string | undefined>,
  layout: Datum[],
  geometry: LineMarkGeometry<Datum>,
): d3.Selection<SVGGElement, Datum, SVGGElement, unknown> {
  const svg = d3.select(svgEl);
  const durationMs = motionDurationMs('--motion-duration-base');
  // Tuple-indexed (not .map()'d) so noUncheckedIndexedAccess doesn't treat
  // any of these as possibly-undefined — MarkShape's fixed 5-tuple length
  // guarantees all five exist.
  const hitClass = `.${shape[0].markerClass}`;
  const ringOuterClass = `.${shape[1].markerClass}`;
  const ringGapClass = `.${shape[2].markerClass}`;
  const lineClass = `.${shape[3].markerClass}`;
  const nameClass = `.${shape[4].markerClass}`;

  const nodes = svg
    .select<SVGGElement>(groupSelector)
    .selectAll<SVGGElement, Datum | undefined>(`g.${nodeClass}`);
  seedPrerenderedData(nodes, layout);
  const groups = nodes
    .data(layout, (d) => d?.id ?? '')
    .join(
      (enter) => {
        const g = enter
          .append('g')
          .attr('class', nodeClass)
          .style('opacity', 0);
        // A brand-new mark starts already at its target row — only a
        // pre-existing mark's row *change* animates (below, via the update
        // selection's transition); an entering mark should just fade in, not
        // also slide in from row 0.
        const [hit, ringOuter, ringGap, line, name] = buildMarkChildren(
          g,
          shape,
          styles,
        );
        hit.attr('y', geometry.hitY).attr('height', geometry.hitHeight);
        ringOuter.attr('y1', geometry.centerY).attr('y2', geometry.centerY);
        ringGap.attr('y1', geometry.centerY).attr('y2', geometry.centerY);
        line.attr('y1', geometry.centerY).attr('y2', geometry.centerY);
        name.attr('y', (d) => d.labelY);
        g.transition().duration(durationMs).style('opacity', 1);
        return g;
      },
      (update) => update,
      (exit) =>
        // pointer-events: none first, so a mark that's mid-fade-out can't
        // still be hovered/clicked.
        exit
          .style('pointer-events', 'none')
          .transition()
          .duration(durationMs)
          .style('opacity', 0)
          .remove(),
    );

  // A row change moves every one of a mark's children by the same vertical
  // amount — captured here, before any attr below overwrites it, as each
  // mark's currently-rendered center-y. Nothing on this path is ever
  // attribute-transitioned (see below), so a mark's line always carries its
  // exact last-committed y1, never a mid-tween snapshot. An entering mark's
  // line was already created at its target y (the enter branch above), so
  // its "previous" position already equals its new one.
  const previousCenterYById = new Map<string, number>();
  groups.each(function (d) {
    const line = this.querySelector<SVGLineElement>(lineClass);
    if (line) previousCenterYById.set(d.id, Number(line.getAttribute('y1')));
  });

  // x/y/fill/data-* attrs all apply instantly now — the row-shift animation
  // moves below to a single group-level transform (see previousCenterYById
  // above) instead of five separate D3 timers each transitioning one
  // child's y/y1/y2/height, which is layout-costly work spread across every
  // visible mark whenever a filter change reshuffles rows. An entering
  // mark already has these set (above), so re-setting them here is a no-op
  // for it and a live update for one that was already on screen.
  groups
    .select<SVGRectElement>(hitClass)
    .attr('x', (d) => geometry.hitX1(d) - HIT_AREA_PADDING_PX)
    .attr('width', (d) => d.hitX2 - geometry.hitX1(d) + HIT_AREA_PADDING_PX * 2)
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .attr('y', geometry.hitY)
    .attr('height', geometry.hitHeight);

  // The ring/gap lines only need x1/x2 kept in sync with the real line
  // (their y and stroke-width are fixed at creation). They're
  // pointer-events: none so carrying the same data-entity-id as the real
  // line never makes them a click/hover target — it's only there so
  // toggleSelectionHighlight can find them by the same selector pattern
  // every other mark uses.
  groups
    .select<SVGLineElement>(ringOuterClass)
    .attr('x1', (d) => d.x1)
    .attr('x2', (d) => d.x2)
    .attr('data-entity-id', (d) => d.id)
    .attr('y1', geometry.centerY)
    .attr('y2', geometry.centerY);

  groups
    .select<SVGLineElement>(ringGapClass)
    .attr('x1', (d) => d.x1)
    .attr('x2', (d) => d.x2)
    .attr('data-entity-id', (d) => d.id)
    .attr('y1', geometry.centerY)
    .attr('y2', geometry.centerY);

  groups
    .select<SVGLineElement>(lineClass)
    .attr('x1', (d) => d.x1)
    .attr('x2', (d) => d.x2)
    .attr('stroke', (d) => d.fill)
    // Lets TimelineCanvas's delegated click listener resolve the source
    // entity (dynamic-tooltips spec §2's click-wiring architecture).
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .attr('y1', geometry.centerY)
    .attr('y2', geometry.centerY);

  groups
    .select<SVGTextElement>(nameClass)
    .attr('x', geometry.labelX)
    .attr('fill', (d) => d.fill)
    // Same delegated-click wiring as the line above, so the label is an
    // equally valid click target for opening the detail drawer.
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .text((d) => d.name)
    .attr('y', (d) => d.labelY);

  // The row-shift itself: ease the mark's own <g> from a `translate` that
  // visually holds it at its old row back to identity, now that every child
  // above already carries its new, real position — one compositor-friendly
  // transform per mark instead of five attribute timers.
  // ponytail: dy is computed from the last *committed* center-y, not any
  // live mid-tween offset, so a row change landing again inside another
  // one's transition can show a small snap instead of a smooth redirect.
  // Upgrade path if that's ever visible: fold the group's current
  // translateY (parsed off its own transform attribute) into dy first.
  groups.each(function (d) {
    const priorCenterY = previousCenterYById.get(d.id) ?? geometry.centerY(d);
    const dy = priorCenterY - geometry.centerY(d);
    const group = d3.select(this);
    group.interrupt();
    if (dy === 0) {
      group.attr('transform', null);
      return;
    }
    // Set synchronously first (a transition's own first tick lands a frame
    // later — see PeopleLane's identical "flash at the wrong position"
    // comment for why that one frame matters), then ease via attrTween with
    // a plain number rather than `.transition().attr('transform', ...)` —
    // the latter hands `transform`/`d` strings to d3-interpolate's dedicated
    // SVG transform interpolator, which parses the *current* CTM via
    // SVGTransformList/baseVal, an API jsdom's test environment doesn't
    // implement.
    group.attr('transform', `translate(0, ${dy})`);
    group
      .transition()
      .duration(durationMs)
      .attrTween('transform', () => {
        const interpolate = d3.interpolateNumber(dy, 0);
        return (t) => `translate(0, ${interpolate(t)})`;
      });
  });

  return groups;
}

/**
 * Toggles the selection-highlight classes on whichever of a lane's marks
 * (already-rendered DOM, found by data-entity-id) match `selectedId` —
 * decoupled from any D3 join's own data binding, since PeopleLane's and
 * ConflictsMilestonesLane's marks are targeted identically here regardless
 * of which join (or join module) produced them.
 */
export function toggleSelectionHighlight(
  svg: SVGSVGElement,
  markSelector: string,
  labelSelector: string,
  selectedId: string | null | undefined,
  highlightClass: string,
  labelHighlightClass: string,
): void {
  const toggle = (selector: string, className: string) => {
    for (const el of svg.querySelectorAll(selector)) {
      el.classList.toggle(
        className,
        el.getAttribute('data-entity-id') === selectedId,
      );
    }
  };
  toggle(markSelector, highlightClass);
  toggle(labelSelector, labelHighlightClass);
}
