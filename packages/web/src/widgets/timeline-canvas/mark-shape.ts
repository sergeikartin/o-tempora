import type * as d3 from 'd3';
import {
  PERIOD_LINE_HEIGHT,
  POINT_RADIUS,
  SELECTED_LINE_HEIGHT_PX,
  SELECTED_POINT_RADIUS_PX,
  SELECTION_RING_GAP_PX,
  SELECTION_RING_WIDTH_PX,
} from './options';

// Not exported from the slice's public index.ts — internal to PeopleLane and
// ConflictsMilestonesLane's own enter branches.

/**
 * One of a mark's 5 fixed DOM children — built once per entering datum, in
 * declaration order, from a `<rect>`/`<line>`/`<circle>`/`<text>`, optionally
 * wrapped in its own `<g>` (the zoom-animation counter-scale target for a
 * label — see PeopleLane's `.d3-name-zoom` comment for why the wrapper has
 * to be a separate node from the text it counter-scales).
 */
export interface MarkShapePart {
  tag: 'rect' | 'line' | 'circle' | 'text';
  /** Literal (non-CSS-Module) marker class the D3 join's enter/update/exit selectors key off. */
  markerClass: string;
  /** Key into the lane's own CSS-Module `styles` object — resolved by the caller, since each lane has its own module. */
  styleKey: string;
  /** Attrs fixed at creation time — never touched again by the update selection. */
  attrs?: Record<string, string | number>;
  /** Wraps this part in its own `<g class={wrapperClass}>`. */
  wrapperClass?: string;
  /** A point mark's label renders as `<tspan>` children for the wrapped multi-line case, not plain text — the caller still owns that `.each` pass, this just flags which part it applies to. */
  supportsTspans?: boolean;
}

/** Every mark kind has exactly these 5 children, in DOM order — a fixed-length tuple (not a plain array) so `buildMarkChildren` can return the matching 5 selections without noUncheckedIndexedAccess treating any of them as possibly-undefined. */
export type MarkShape = readonly [
  MarkShapePart,
  MarkShapePart,
  MarkShapePart,
  MarkShapePart,
  MarkShapePart,
];

const RING_OUTER_ATTRS = {
  'stroke-width':
    SELECTED_LINE_HEIGHT_PX +
    2 * (SELECTION_RING_GAP_PX + SELECTION_RING_WIDTH_PX),
  'stroke-linecap': 'round',
};
const RING_GAP_ATTRS = {
  'stroke-width': SELECTED_LINE_HEIGHT_PX + 2 * SELECTION_RING_GAP_PX,
  'stroke-linecap': 'round',
};
const LINE_ATTRS = {
  'stroke-width': PERIOD_LINE_HEIGHT,
  'stroke-linecap': 'round',
};

export const PERSON_MARK_SHAPE: MarkShape = [
  { tag: 'rect', markerClass: 'd3-hit', styleKey: 'hitArea' },
  {
    tag: 'line',
    markerClass: 'd3-line-ring-outer',
    styleKey: 'lineRingOuter',
    attrs: RING_OUTER_ATTRS,
  },
  {
    tag: 'line',
    markerClass: 'd3-line-ring-gap',
    styleKey: 'lineRingGap',
    attrs: RING_GAP_ATTRS,
  },
  { tag: 'line', markerClass: 'd3-line', styleKey: 'line', attrs: LINE_ATTRS },
  {
    tag: 'text',
    markerClass: 'd3-name',
    styleKey: 'name',
    attrs: { 'dominant-baseline': 'hanging' },
    wrapperClass: 'd3-name-zoom',
  },
];

export const RANGE_MARK_SHAPE: MarkShape = [
  { tag: 'rect', markerClass: 'd3-hit', styleKey: 'hitArea' },
  {
    tag: 'line',
    markerClass: 'd3-line-ring-outer',
    styleKey: 'lineRingOuter',
    attrs: RING_OUTER_ATTRS,
  },
  {
    tag: 'line',
    markerClass: 'd3-line-ring-gap',
    styleKey: 'lineRingGap',
    attrs: RING_GAP_ATTRS,
  },
  { tag: 'line', markerClass: 'd3-line', styleKey: 'line', attrs: LINE_ATTRS },
  {
    tag: 'text',
    markerClass: 'd3-range-name',
    styleKey: 'label',
    attrs: { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' },
    wrapperClass: 'd3-range-name-zoom',
  },
];

export const POINT_MARK_SHAPE: MarkShape = [
  { tag: 'rect', markerClass: 'd3-hit', styleKey: 'hitArea' },
  {
    tag: 'circle',
    markerClass: 'd3-dot-ring-outer',
    styleKey: 'dotRingOuter',
    attrs: {
      r:
        SELECTED_POINT_RADIUS_PX +
        SELECTION_RING_GAP_PX +
        SELECTION_RING_WIDTH_PX,
    },
  },
  {
    tag: 'circle',
    markerClass: 'd3-dot-ring-gap',
    styleKey: 'dotRingGap',
    attrs: { r: SELECTED_POINT_RADIUS_PX + SELECTION_RING_GAP_PX },
  },
  {
    tag: 'circle',
    markerClass: 'd3-dot',
    styleKey: 'dot',
    attrs: { r: POINT_RADIUS },
  },
  {
    tag: 'text',
    markerClass: 'd3-point-name',
    styleKey: 'label',
    attrs: { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' },
    wrapperClass: 'd3-point-name-zoom',
    supportsTspans: true,
  },
];

/** Every mark's real hover/click target — see each lane's own `.d3-hit` comment for why a thin line/dot needs a separate, oversized rect. */
export const MARK_ID_SELECTOR = '.d3-hit';

/**
 * Appends one mark's fixed children (per `shape`, in the same order) under
 * `g`, returned in that same order so the caller can destructure them
 * positionally and attach each part's data-driven initial position — that
 * part varies per mark kind and stays with the lane, not the shared shape.
 */
type MarkChild<Datum> = d3.Selection<Element, Datum, SVGGElement, unknown>;

export function buildMarkChildren<Datum>(
  g: d3.Selection<SVGGElement, Datum, SVGGElement, unknown>,
  shape: MarkShape,
  // CSS-Module classes always exist in the compiled module — the indexed
  // access only reads as possibly-undefined because of
  // noUncheckedIndexedAccess, not because a key might really be missing.
  styles: Record<string, string | undefined>,
): readonly [
  MarkChild<Datum>,
  MarkChild<Datum>,
  MarkChild<Datum>,
  MarkChild<Datum>,
  MarkChild<Datum>,
] {
  const build = (part: MarkShapePart): MarkChild<Datum> => {
    const parent = part.wrapperClass
      ? g.append('g').attr('class', part.wrapperClass)
      : g;
    const el = parent
      .append(part.tag)
      .attr('class', `${part.markerClass} ${styles[part.styleKey] as string}`);
    if (part.attrs) {
      for (const [name, value] of Object.entries(part.attrs)) {
        el.attr(name, value);
      }
    }
    return el as unknown as MarkChild<Datum>;
  };
  return [
    build(shape[0]),
    build(shape[1]),
    build(shape[2]),
    build(shape[3]),
    build(shape[4]),
  ];
}
