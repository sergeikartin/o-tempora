import type { PersonLayout, PointLayout, RangeLayout } from './map-to-items';
import {
  type MarkShape,
  type MarkShapePart,
  PERSON_MARK_SHAPE,
  POINT_MARK_SHAPE,
  RANGE_MARK_SHAPE,
} from './mark-shape';
import {
  HIT_AREA_PADDING_PX,
  MILESTONES_LABEL_LINE_HEIGHT_PX,
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
} from './options';

// HTML-string counterpart to mark-shape.ts's buildMarkChildren — same
// MarkShape descriptor, same fixed attrs, same per-datum attrs each lane's
// D3 join sets on a freshly-entered mark, but rendered as a literal string
// instead of appended to a live D3 selection. PeopleLane/ConflictsMilestones
// Lane each call the list-level renderers below (renderPeopleMarkupHtml etc.)
// once, in a lazy useState initializer, to seed their <g>'s
// dangerouslySetInnerHTML with real content on first render — identically on
// the server (vite-plugins/prerender-default-viewport.ts, via
// App.tsx's initialDatasets seam) and the client, so hydration has nothing
// to reconcile there. The D3 join's `enter` branch (buildMarkChildren)
// remains the separate consumer for marks that appear *after* that first
// render (a filter change, Tier 1 merging in) — this module and mark-shape.ts
// share one descriptor between the two, never a hand-duplicated second shape.

type Attrs = Record<string, string | number>;

// Mirrors what a real browser attribute serializes to; the datasets here are
// pipeline-generated (CLAUDE.md), not user input, but escaping stays cheap
// insurance against a name/label containing '&', '<', or '"'.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrsToHtml(attrs: Attrs): string {
  return Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeHtml(String(value))}"`)
    .join('');
}

/** One mark part rendered as an HTML string — `innerHtml` is caller-built (only ever used for the text part: a plain escaped name, or pre-escaped `<tspan>`s for a wrapped multi-line label). */
function renderMarkPartHtml(
  part: MarkShapePart,
  styles: Record<string, string | undefined>,
  dynamicAttrs: Attrs,
  innerHtml = '',
): string {
  const classAttr = `${part.markerClass} ${styles[part.styleKey] ?? ''}`;
  const el = `<${part.tag} class="${classAttr}"${part.attrs ? attrsToHtml(part.attrs) : ''}${attrsToHtml(dynamicAttrs)}>${innerHtml}</${part.tag}>`;
  return part.wrapperClass ? `<g class="${part.wrapperClass}">${el}</g>` : el;
}

function markTextInnerHtml(text: string): string {
  return escapeHtml(text);
}

/** `<tspan>` content for a point mark's wrapped multi-line label — mirrors ConflictsMilestonesLane's `renderLines` `.each` pass exactly (trailing space on every non-final line, so rendered textContent matches the source name). */
function markTspansInnerHtml(
  lines: string[],
  x: number,
  lineHeightPx: number,
): string {
  return lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeightPx;
      const text = i < lines.length - 1 ? `${line} ` : line;
      return `<tspan x="${x}" dy="${dy}">${escapeHtml(text)}</tspan>`;
    })
    .join('');
}

/** One full mark `<g>` — group class/attrs plus its 5 shape-defined children, in order. `partAttrs`/`textInnerHtml` are indexed the same as `shape`. */
function renderMarkGroupHtml(
  groupClass: string,
  groupAttrs: Attrs,
  shape: MarkShape,
  styles: Record<string, string | undefined>,
  partAttrs: readonly [Attrs, Attrs, Attrs, Attrs, Attrs],
  textInnerHtml: string,
): string {
  const children = shape
    .map((part, i) =>
      // Indices 1/2 (ring-outer/ring-gap): omitted from every mark's
      // initial paint. They're only ever visible on the (at most one)
      // selected mark, so pre-building an always-invisible pair for the
      // other ~99% just to have them ready costs real layout/style-recalc
      // time on first paint for no visual benefit — mark-join.ts's
      // ensureRingChildren lazily creates them, straight off the real
      // mark's own geometry, the first time a given mark is ever selected.
      i === 1 || i === 2
        ? ''
        : renderMarkPartHtml(
            part,
            styles,
            partAttrs[i] as Attrs,
            i === shape.length - 1 ? textInnerHtml : '',
          ),
    )
    .join('');
  return `<g class="${groupClass}"${attrsToHtml(groupAttrs)}>${children}</g>`;
}

function renderPersonMarkHtml(
  item: PersonLayout,
  styles: Record<string, string | undefined>,
): string {
  const y = item.labelY - HIT_AREA_PADDING_PX;
  const height =
    item.lineY + PERIOD_LINE_HEIGHT / 2 - item.labelY + HIT_AREA_PADDING_PX * 2;
  return renderMarkGroupHtml(
    'd3-person',
    {},
    PERSON_MARK_SHAPE,
    styles,
    [
      {
        x: item.x1 - HIT_AREA_PADDING_PX,
        width: item.hitX2 - item.x1 + HIT_AREA_PADDING_PX * 2,
        y,
        height,
        'data-entity-id': item.id,
        'data-entity-type': 'person',
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.lineY,
        y2: item.lineY,
        'data-entity-id': item.id,
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.lineY,
        y2: item.lineY,
        'data-entity-id': item.id,
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.lineY,
        y2: item.lineY,
        stroke: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': 'person',
      },
      {
        x: item.x1,
        y: item.labelY,
        fill: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': 'person',
      },
    ],
    markTextInnerHtml(item.name),
  );
}

function renderRangeMarkHtml(
  item: RangeLayout,
  styles: Record<string, string | undefined>,
): string {
  const y = item.markerY - PERIOD_LINE_HEIGHT / 2 - HIT_AREA_PADDING_PX;
  const height =
    item.labelY +
    MILESTONES_LABEL_LINE_HEIGHT_PX -
    (item.markerY - PERIOD_LINE_HEIGHT / 2) +
    HIT_AREA_PADDING_PX * 2;
  return renderMarkGroupHtml(
    'd3-range',
    { 'data-row': item.row },
    RANGE_MARK_SHAPE,
    styles,
    [
      {
        x: item.hitX1 - HIT_AREA_PADDING_PX,
        width: item.hitX2 - item.hitX1 + HIT_AREA_PADDING_PX * 2,
        y,
        height,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.markerY,
        y2: item.markerY,
        'data-entity-id': item.id,
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.markerY,
        y2: item.markerY,
        'data-entity-id': item.id,
      },
      {
        x1: item.x1,
        x2: item.x2,
        y1: item.markerY,
        y2: item.markerY,
        stroke: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      {
        x: (item.x1 + item.x2) / 2,
        y: item.labelY,
        fill: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
    ],
    markTextInnerHtml(item.name),
  );
}

function renderPointMarkHtml(
  item: PointLayout,
  styles: Record<string, string | undefined>,
): string {
  const y = item.markerY - POINT_RADIUS - HIT_AREA_PADDING_PX;
  const height =
    item.labelY +
    item.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX -
    (item.markerY - POINT_RADIUS) +
    HIT_AREA_PADDING_PX * 2;
  return renderMarkGroupHtml(
    'd3-point-group',
    { 'data-row': item.row },
    POINT_MARK_SHAPE,
    styles,
    [
      {
        x: item.hitX1 - HIT_AREA_PADDING_PX,
        width: item.hitX2 - item.hitX1 + HIT_AREA_PADDING_PX * 2,
        y,
        height,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      { cx: item.x, cy: item.markerY, 'data-entity-id': item.id },
      { cx: item.x, cy: item.markerY, 'data-entity-id': item.id },
      {
        cx: item.x,
        cy: item.markerY,
        fill: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      {
        x: item.x,
        y: item.labelY,
        fill: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
    ],
    markTspansInnerHtml(item.lines, item.x, MILESTONES_LABEL_LINE_HEIGHT_PX),
  );
}

/** PeopleLane's initial `g.people` content — `styles` is its own CSS-Module import, so class hashes always match whichever build (real or prerender) is calling this. */
export function renderPeopleMarkupHtml(
  layout: PersonLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderPersonMarkHtml(item, styles)).join('');
}

/** ConflictsMilestonesLane's initial `g.ranges` content. */
export function renderRangesMarkupHtml(
  layout: RangeLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderRangeMarkHtml(item, styles)).join('');
}

/** ConflictsMilestonesLane's initial `g.points` content. */
export function renderPointsMarkupHtml(
  layout: PointLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderPointMarkHtml(item, styles)).join('');
}
