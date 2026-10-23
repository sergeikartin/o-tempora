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
  POINT_LABEL_OFFSET_PX,
  pointHitHeight,
  pointHitY,
  pointLabelY,
} from './options';

// HTML-string counterpart to mark-shape.ts's buildMarkChildren: the same
// MarkShape descriptor and attrs, rendered as a string. PeopleLane and
// ConflictsMilestonesLane call the list-level renderers below once, in a lazy
// useState initializer, to seed their <g>'s dangerouslySetInnerHTML,
// identically on the server (vite-plugins/prerender-default-viewport.ts via
// App.tsx's initialDatasets) and the client, so hydration has nothing to
// reconcile. The D3 join's `enter` branch (buildMarkChildren) handles marks
// that appear later (e.g. a filter change, a deeper Detail Level loading);
// both share one descriptor.

type Attrs = Record<string, string | number>;

// Mirrors browser attribute serialization. The data is pipeline-generated, but
// escaping is cheap insurance against '&', '<' or '"' in a name.
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

/** `<tspan>` content for a wrapped multi-line label — mirrors attachMarkJoin's `renderLines` pass exactly (trailing space on every non-final line, so rendered textContent matches the source name). */
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
  partAttrs: readonly [Attrs, Attrs, Attrs, Attrs],
  textInnerHtml: string,
): string {
  const children = shape
    .map((part, i) =>
      // Index 1 (halo): omitted from the initial paint. Only the one selected mark
      // shows a halo, and pre-building invisible ones for the rest costs layout and
      // style recalc on first paint; mark-join.ts's ensureHaloChild creates it from
      // the real mark's geometry the first time a mark is selected.
      i === 1
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
        stroke: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': 'person',
      },
      {
        x: item.x1,
        y: item.labelY,
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
    item.lines.length * MILESTONES_LABEL_LINE_HEIGHT_PX -
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
        stroke: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      {
        x: item.x1,
        y: item.labelY,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
    ],
    markTspansInnerHtml(item.lines, item.x1, MILESTONES_LABEL_LINE_HEIGHT_PX),
  );
}

function renderPointMarkHtml(
  item: PointLayout,
  styles: Record<string, string | undefined>,
): string {
  const lineCount = item.lines.length;
  const y = pointHitY(item.markerY, lineCount);
  const height = pointHitHeight(lineCount);
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
      {
        cx: item.x,
        cy: item.markerY,
        fill: item.fill,
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
      {
        x: item.x + POINT_LABEL_OFFSET_PX,
        y: pointLabelY(item.markerY, lineCount),
        'data-entity-id': item.id,
        'data-entity-type': item.kind,
      },
    ],
    markTspansInnerHtml(
      item.lines,
      item.x + POINT_LABEL_OFFSET_PX,
      MILESTONES_LABEL_LINE_HEIGHT_PX,
    ),
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
