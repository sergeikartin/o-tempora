import * as d3 from 'd3';
import { motionDurationMs } from '../../shared/lib/motion';
import {
  buildMarkChildren,
  type MarkShape,
  type MarkShapePart,
  seedPrerenderedData,
} from './mark-shape';
import {
  HIT_AREA_PADDING_PX,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
} from './options';

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
  /** Shared by the halo/line parts — both sit on the same vertical center. */
  centerY: (d: Datum) => number;
  labelX: (d: Datum) => number;
  /** Wrapped label lines; omitted for a single-line label (`d.name`). */
  lines?: (d: Datum) => string[];
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
  // Tuple-indexed so noUncheckedIndexedAccess doesn't flag the 4-tuple's items.
  const hitClass = `.${shape[0].markerClass}`;
  const haloClass = `.${shape[1].markerClass}`;
  const lineClass = `.${shape[2].markerClass}`;
  const nameClass = `.${shape[3].markerClass}`;

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
        // A new mark starts at its target row: only an existing mark's row change
        // animates (update selection's transition); an entering mark just fades in.
        const [hit, halo, line, name] = buildMarkChildren(g, shape, styles);
        hit.attr('y', geometry.hitY).attr('height', geometry.hitHeight);
        halo.attr('y1', geometry.centerY).attr('y2', geometry.centerY);
        line.attr('y1', geometry.centerY).attr('y2', geometry.centerY);
        name.attr('y', (d) => d.labelY);
        g.transition().duration(durationMs).style('opacity', 1);
        return g;
      },
      // A datum that re-enters before its exit transition finished (e.g. a filter
      // toggled back within motionDurationMs) rejoins as `update` with its DOM node
      // mid-fade and the pending unnamed opacity-to-0-then-remove transition.
      // interrupt() cancels it so it can't remove a mark being kept, and resetting
      // opacity/pointer-events undoes what it applied (a no-op for a node that
      // wasn't exiting).
      (update) =>
        update.interrupt().style('opacity', 1).style('pointer-events', null),
      (exit) =>
        // pointer-events: none first, so a fading-out mark can't be hovered or clicked.
        exit
          .style('pointer-events', 'none')
          .transition()
          .duration(durationMs)
          .style('opacity', 0)
          .remove(),
    );

  // A row change moves all of a mark's children by the same vertical amount;
  // capture each mark's currently rendered center-y before any attr below
  // overwrites it. Nothing here is attribute-transitioned, so a line always
  // carries its last committed y1, never a mid-tween value. An entering mark was
  // created at its target y, so its previous position equals its new one.
  const previousCenterYById = new Map<string, number>();
  groups.each(function (d) {
    const line = this.querySelector<SVGLineElement>(lineClass);
    if (line) previousCenterYById.set(d.id, Number(line.getAttribute('y1')));
  });

  // x/y/fill/data-* attrs apply instantly; the row-shift animation is one
  // group-level transform (see previousCenterYById) rather than five D3 timers
  // per mark, which is layout-costly across every visible mark when a filter
  // reshuffles rows. Re-setting them on an entering mark is a no-op.
  groups
    .select<SVGRectElement>(hitClass)
    .attr('x', (d) => geometry.hitX1(d) - HIT_AREA_PADDING_PX)
    .attr('width', (d) => d.hitX2 - geometry.hitX1(d) + HIT_AREA_PADDING_PX * 2)
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .attr('y', geometry.hitY)
    .attr('height', geometry.hitHeight);

  // The halo line only needs x1/x2 synced with the real line (y and
  // stroke-width are fixed at creation). It is pointer-events: none, so sharing
  // the real line's data-entity-id doesn't make it a target; it exists so
  // toggleSelectionHighlight finds it by the usual selector.
  groups
    .select<SVGLineElement>(haloClass)
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
    // Lets TimelineCanvas's delegated click listener resolve the entity.
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .attr('y1', geometry.centerY)
    .attr('y2', geometry.centerY);

  groups
    .select<SVGTextElement>(nameClass)
    .attr('x', geometry.labelX)
    // Same delegated-click wiring as the line, so the label is also a click target.
    .attr('data-entity-id', (d) => d.id)
    .attr('data-entity-type', geometry.entityType)
    .each(function renderLines(d) {
      const lines = geometry.lines?.(d);
      if (!lines) {
        d3.select(this).text(d.name);
        return;
      }
      // A trailing space on every non-final tspan keeps the rendered
      // textContent equal to the source name.
      d3.select(this)
        .selectAll<SVGTSpanElement, string>('tspan')
        .data(lines)
        .join('tspan')
        .attr('x', geometry.labelX(d))
        .attr('dy', (_line, i) =>
          i === 0 ? 0 : MILESTONES_LABEL_LINE_HEIGHT_PX,
        )
        .text((line, i) => (i < lines.length - 1 ? `${line} ` : line));
    })
    .attr('y', (d) => d.labelY);

  // The row shift: ease the mark's <g> from a `translate` that holds it at its
  // old row back to identity, now that its children carry their new positions;
  // one compositor-friendly transform instead of five attribute timers.
  // Known limitation: dy is computed from the last committed center-y, not a live
  // mid-tween offset, so a row change landing inside another's transition can
  // snap. Fix by folding the group's current translateY (parsed from its
  // transform attribute) into dy.
  groups.each(function (d) {
    const priorCenterY = previousCenterYById.get(d.id) ?? geometry.centerY(d);
    const dy = priorCenterY - geometry.centerY(d);
    const group = d3.select(this);
    // Named so this only interrupts a prior row-shift transition: an unnamed
    // interrupt() would also cancel the enter branch's pending unnamed fade-in
    // (D3 keys transitions by node and name), leaving a new mark invisible.
    group.interrupt('row-shift');
    if (dy === 0) {
      group.attr('transform', null);
      return;
    }
    // Set synchronously first (a transition's first tick lands a frame later; see
    // PeopleLane's comment on the flash), then eased with attrTween on a plain
    // number: `.transition().attr('transform', ...)` hands strings to d3's SVG
    // transform interpolator, which parses the CTM via SVGTransformList/baseVal, an
    // API jsdom lacks.
    group.attr('transform', `translate(0, ${dy})`);
    group
      .transition('row-shift')
      .duration(durationMs)
      .attrTween('transform', () => {
        const interpolate = d3.interpolateNumber(dy, 0);
        return (t) => `translate(0, ${interpolate(t)})`;
      });
  });

  return groups;
}

/**
 * Creates `id`'s mark's halo the first time it's selected (mark-shape-html.ts
 * omits it from the initial paint, so most marks have none). Halo geometry
 * matches the real mark's x1/x2/y1/y2 (or cx/cy); only stroke-width/r
 * (mark-shape.ts's HALO_LINE_ATTRS) differ, so this copies `geometryAttrs`
 * from the sibling real element found via `markClass` instead of re-deriving
 * from layout data. A no-op if the halo exists or `id` matches no element
 * under `markClass` in this `svg` (e.g. a point id checked against
 * `.d3-line`).
 */
export function ensureHaloChild(
  svg: SVGSVGElement,
  markClass: string,
  haloPart: MarkShapePart,
  styles: Record<string, string | undefined>,
  id: string | null | undefined,
  geometryAttrs: readonly string[],
): void {
  if (!id) return;
  const real = svg.querySelector<SVGGraphicsElement>(
    `${markClass}[data-entity-id="${id}"]`,
  );
  const group = real?.parentElement;
  if (!real || !group) return;
  if (group.querySelector(`.${haloPart.markerClass}`)) return;

  const build = (part: MarkShapePart): SVGElement => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', part.tag);
    el.setAttribute(
      'class',
      `${part.markerClass} ${styles[part.styleKey] ?? ''}`,
    );
    for (const [name, value] of Object.entries(part.attrs ?? {})) {
      el.setAttribute(name, String(value));
    }
    for (const attr of geometryAttrs) {
      const value = real.getAttribute(attr);
      if (value !== null) el.setAttribute(attr, value);
    }
    el.setAttribute('data-entity-id', id);
    return el;
  };

  // DOM order matters for paint order — the halo goes behind the real mark
  // already sitting at `real` (mark-shape.ts's declared 4-child order).
  group.insertBefore(build(haloPart), real);
}

/**
 * Toggles the selection-highlight classes on whichever of a lane's marks
 * (already-rendered DOM, found by data-entity-id) match one of `selectedIds` —
 * decoupled from any D3 join's own data binding, since PeopleLane's and
 * ConflictsMilestonesLane's marks are targeted identically here regardless
 * of which join (or join module) produced them.
 */
export function toggleSelectionHighlight(
  svg: SVGSVGElement,
  markSelector: string,
  labelSelector: string,
  selectedIds: readonly string[],
  highlightClass: string,
  labelHighlightClass: string,
): void {
  const toggle = (selector: string, className: string) => {
    for (const el of svg.querySelectorAll(selector)) {
      el.classList.toggle(
        className,
        selectedIds.includes(el.getAttribute('data-entity-id') ?? ''),
      );
    }
  };
  toggle(markSelector, highlightClass);
  toggle(labelSelector, labelHighlightClass);
}
