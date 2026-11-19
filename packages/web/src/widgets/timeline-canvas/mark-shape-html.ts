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

// Share MarkShape with the D3 join so prerendered marks and marks added
// after hydration use the same DOM structure.

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

// Callers must escape innerHtml before passing in label text or tspans.
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

// Preserve spaces between tspans so textContent matches the source name.
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
      // Skip invisible halos on first paint to avoid their layout and style cost.
      // The join creates one from the mark’s geometry on selection.
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

export function renderPeopleMarkupHtml(
  layout: PersonLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderPersonMarkHtml(item, styles)).join('');
}

export function renderRangesMarkupHtml(
  layout: RangeLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderRangeMarkHtml(item, styles)).join('');
}

export function renderPointsMarkupHtml(
  layout: PointLayout[],
  styles: Record<string, string | undefined>,
): string {
  return layout.map((item) => renderPointMarkHtml(item, styles)).join('');
}
