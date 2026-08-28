import { afterEach, expect, test } from 'vitest';
import {
  attachMarkJoin,
  ensureRingChildren,
  type LineMarkDatum,
  toggleSelectionHighlight,
} from './mark-join';
import { PERSON_MARK_SHAPE } from './mark-shape';
import { HIT_AREA_PADDING_PX } from './options';

afterEach(() => {
  document.body.innerHTML = '';
});

const fakeStyles = {
  hitArea: 'hitArea-css',
  lineRingOuter: 'lineRingOuter-css',
  lineRingGap: 'lineRingGap-css',
  line: 'line-css',
  name: 'name-css',
};

interface FakeDatum extends LineMarkDatum {
  centerY: number;
}

const geometry = {
  hitX1: (d: FakeDatum) => d.x1,
  hitY: (d: FakeDatum) => d.labelY - HIT_AREA_PADDING_PX,
  hitHeight: () => 20,
  centerY: (d: FakeDatum) => d.centerY,
  labelX: (d: FakeDatum) => d.x1,
  entityType: () => 'thing',
};

function mountSvg(): SVGSVGElement {
  document.body.innerHTML = '<svg><g class="marks"></g></svg>';
  return document.querySelector('svg') as unknown as SVGSVGElement;
}

const target = { groupSelector: 'g.marks', nodeClass: 'd3-thing' };

test('attaches hit/ring/line/name attrs per the supplied geometry accessors', () => {
  const svg = mountSvg();
  const layout: FakeDatum[] = [
    {
      id: 'a',
      name: 'Alpha',
      x1: 10,
      x2: 50,
      hitX2: 60,
      labelY: 100,
      centerY: 90,
      fill: 'red',
    },
  ];
  attachMarkJoin(svg, target, PERSON_MARK_SHAPE, fakeStyles, layout, geometry);

  const line = svg.querySelector('.d3-line');
  expect(line?.getAttribute('x1')).toBe('10');
  expect(line?.getAttribute('x2')).toBe('50');
  expect(line?.getAttribute('y1')).toBe('90');
  expect(line?.getAttribute('stroke')).toBe('red');
  expect(line?.getAttribute('data-entity-id')).toBe('a');
  expect(line?.getAttribute('data-entity-type')).toBe('thing');

  const hit = svg.querySelector('.d3-hit');
  expect(hit?.getAttribute('x')).toBe(String(10 - HIT_AREA_PADDING_PX));
  expect(hit?.getAttribute('width')).toBe(
    String(60 - 10 + HIT_AREA_PADDING_PX * 2),
  );

  const name = svg.querySelector('.d3-name');
  expect(name?.textContent).toBe('Alpha');
  expect(name?.getAttribute('x')).toBe('10');
  expect(name?.getAttribute('fill')).toBe('red');
});

test('adopts a prerendered, unbound node instead of destroying and recreating it', () => {
  const svg = mountSvg();
  const group = svg.querySelector('g.marks') as SVGGElement;
  group.insertAdjacentHTML(
    'beforeend',
    `<g class="d3-thing" style="opacity: 1">
      <rect class="d3-hit hitArea-css" data-entity-id="a" data-entity-type="thing"></rect>
      <line class="d3-line-ring-outer lineRingOuter-css"></line>
      <line class="d3-line-ring-gap lineRingGap-css"></line>
      <line class="d3-line line-css" x1="-1" y1="-1" data-entity-id="a" data-entity-type="thing"></line>
      <g class="d3-name-zoom"><text class="d3-name name-css" x="-1" y="-1" data-entity-id="a" data-entity-type="thing">Alpha</text></g>
    </g>`,
  );
  const prerenderedNode = group.querySelector('.d3-thing') as HTMLElement;
  prerenderedNode.setAttribute('data-test-marker', 'prerendered');

  const layout: FakeDatum[] = [
    {
      id: 'a',
      name: 'Alpha',
      x1: 10,
      x2: 50,
      hitX2: 60,
      labelY: 100,
      centerY: 90,
      fill: 'red',
    },
  ];
  attachMarkJoin(svg, target, PERSON_MARK_SHAPE, fakeStyles, layout, geometry);

  // Same node, not a replacement — an exit+enter would have removed this
  // node and appended a fresh one instead.
  expect(svg.querySelector('[data-test-marker="prerendered"]')).toBe(
    prerenderedNode,
  );
  expect(svg.querySelectorAll('.d3-thing')).toHaveLength(1);
  // enter is what sets opacity:0 to fade in from — update never touches
  // opacity, so an adopted node never flashes invisible.
  expect(prerenderedNode.style.opacity).not.toBe('0');
});

test('removes a mark no longer present in layout', async () => {
  const svg = mountSvg();
  const layout: FakeDatum[] = [
    {
      id: 'a',
      name: 'Alpha',
      x1: 10,
      x2: 50,
      hitX2: 60,
      labelY: 100,
      centerY: 90,
      fill: 'red',
    },
  ];
  attachMarkJoin(svg, target, PERSON_MARK_SHAPE, fakeStyles, layout, geometry);
  expect(svg.querySelectorAll('.d3-thing')).toHaveLength(1);

  attachMarkJoin(svg, target, PERSON_MARK_SHAPE, fakeStyles, [], geometry);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(svg.querySelectorAll('.d3-thing')).toHaveLength(0);
});

test('toggleSelectionHighlight toggles the highlight class only on the selected entity', () => {
  document.body.innerHTML = `
    <svg>
      <line class="d3-line" data-entity-id="a"></line>
      <line class="d3-line" data-entity-id="b"></line>
      <text class="d3-name" data-entity-id="a"></text>
      <text class="d3-name" data-entity-id="b"></text>
    </svg>`;
  const svg = document.querySelector('svg') as unknown as SVGSVGElement;

  toggleSelectionHighlight(
    svg,
    '.d3-line[data-entity-id]',
    '.d3-name[data-entity-id]',
    'a',
    'highlight',
    'highlight-label',
  );

  const [lineA, lineB] = svg.querySelectorAll('.d3-line');
  const [nameA, nameB] = svg.querySelectorAll('.d3-name');
  expect(lineA?.classList.contains('highlight')).toBe(true);
  expect(lineB?.classList.contains('highlight')).toBe(false);
  expect(nameA?.classList.contains('highlight-label')).toBe(true);
  expect(nameB?.classList.contains('highlight-label')).toBe(false);

  toggleSelectionHighlight(
    svg,
    '.d3-line[data-entity-id]',
    '.d3-name[data-entity-id]',
    null,
    'highlight',
    'highlight-label',
  );
  expect(lineA?.classList.contains('highlight')).toBe(false);
});

test('ensureRingChildren creates a missing ring pair from the real mark’s own geometry, once', () => {
  document.body.innerHTML = `
    <svg>
      <g class="d3-person">
        <line class="d3-line" data-entity-id="a" x1="10" x2="20" y1="5" y2="5"></line>
      </g>
    </svg>`;
  const svg = document.querySelector('svg') as unknown as SVGSVGElement;

  ensureRingChildren(
    svg,
    '.d3-line',
    PERSON_MARK_SHAPE[1],
    PERSON_MARK_SHAPE[2],
    fakeStyles,
    'a',
    ['x1', 'x2', 'y1', 'y2'],
  );

  const group = svg.querySelector('.d3-person') as Element;
  const ringOuter = group.querySelector('.d3-line-ring-outer');
  const ringGap = group.querySelector('.d3-line-ring-gap');
  expect(ringOuter?.getAttribute('x1')).toBe('10');
  expect(ringOuter?.getAttribute('x2')).toBe('20');
  expect(ringOuter?.getAttribute('data-entity-id')).toBe('a');
  expect(ringGap?.getAttribute('x1')).toBe('10');
  // Paint order: outer, then gap, then the real line on top.
  expect(
    Array.from(group.children).map((el) => el.getAttribute('class')),
  ).toEqual([
    'd3-line-ring-outer lineRingOuter-css',
    'd3-line-ring-gap lineRingGap-css',
    'd3-line',
  ]);

  ensureRingChildren(
    svg,
    '.d3-line',
    PERSON_MARK_SHAPE[1],
    PERSON_MARK_SHAPE[2],
    fakeStyles,
    'a',
    ['x1', 'x2', 'y1', 'y2'],
  );
  expect(group.querySelectorAll('.d3-line-ring-outer')).toHaveLength(1);
});

test('ensureRingChildren no-ops for an id with no matching mark', () => {
  document.body.innerHTML = `
    <svg>
      <g class="d3-person">
        <line class="d3-line" data-entity-id="a" x1="10" x2="20" y1="5" y2="5"></line>
      </g>
    </svg>`;
  const svg = document.querySelector('svg') as unknown as SVGSVGElement;

  ensureRingChildren(
    svg,
    '.d3-line',
    PERSON_MARK_SHAPE[1],
    PERSON_MARK_SHAPE[2],
    fakeStyles,
    'missing',
    ['x1', 'x2', 'y1', 'y2'],
  );

  expect(svg.querySelector('.d3-line-ring-outer')).toBeNull();
});
