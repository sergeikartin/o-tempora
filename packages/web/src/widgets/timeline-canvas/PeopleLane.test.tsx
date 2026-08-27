import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Person } from '../../shared/types';
import { computeRowAssignment } from './map-to-items';
import { buildXScale } from './options';
import { PeopleLane } from './PeopleLane';

afterEach(cleanup);

const aristotle: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const caesar: Person = {
  id: 'Q1048',
  name: 'Julius Caesar',
  lifespan: { start: { year: -100 }, end: { year: -44 } },
  occupationDomain: 'institutions',
  regionTags: [],
  fameScore: 400,
  tagline: 'Roman general and statesman',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Julius_Caesar',
};

test('renders one lifespan line per person, with the name labeled above it', () => {
  const { scale } = buildXScale(2);
  const people = [aristotle, caesar];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const lines = container.querySelectorAll('.d3-line');
  expect(lines).toHaveLength(2);
  const names = Array.from(container.querySelectorAll('.d3-name')).map(
    (el) => el.textContent,
  );
  expect(names).toEqual(expect.arrayContaining(['Aristotle', 'Julius Caesar']));
});

test("a person's name label sits above their lifespan line", () => {
  const { scale } = buildXScale(2);
  const people = [aristotle];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const line = container.querySelector('.d3-line');
  const label = container.querySelector('.d3-name');
  expect(Number(label?.getAttribute('y'))).toBeLessThan(
    Number(line?.getAttribute('y1')),
  );
});

test("a person's name label is colored to match their lifespan line", () => {
  const { scale } = buildXScale(2);
  const people = [aristotle];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const line = container.querySelector('.d3-line');
  const label = container.querySelector('.d3-name');
  expect(label?.getAttribute('fill')).toBe(line?.getAttribute('stroke'));
});

test('renders no stems', () => {
  const { scale } = buildXScale(2);
  const people = [aristotle, caesar];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-stem')).toHaveLength(0);
});

test('two overlapping lifespans render at different y positions (separate rows)', () => {
  const { scale } = buildXScale(2);
  const overlappingCaesar: Person = {
    ...caesar,
    lifespan: { start: { year: -383 }, end: { year: -321 } },
    row: 1,
  };
  const people = [{ ...aristotle, row: 0 }, overlappingCaesar];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const ys = lines.map((line) => line.getAttribute('y1'));
  expect(new Set(ys).size).toBe(2);
});

test('two non-overlapping lifespans render at the same y position (same row)', () => {
  const { scale } = buildXScale(2);
  const people = [aristotle, caesar];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const ys = lines.map((line) => line.getAttribute('y1'));
  expect(new Set(ys).size).toBe(1);
});

test('the more famous of two overlapping people renders closer to the bottom of the lane (nearer the shared Year Axis below)', () => {
  const { scale } = buildXScale(2);
  const famousOverlap: Person = {
    ...caesar,
    id: 'Q-famous',
    fameScore: 999,
    row: 0,
  };
  const obscureOverlap: Person = {
    ...aristotle,
    id: 'Q-obscure',
    lifespan: caesar.lifespan,
    fameScore: 1,
    row: 1,
  };
  const people = [obscureOverlap, famousOverlap];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const famousLine = lines.find(
    (line) => line.getAttribute('data-entity-id') === 'Q-famous',
  );
  const obscureLine = lines.find(
    (line) => line.getAttribute('data-entity-id') === 'Q-obscure',
  );
  expect(Number(famousLine?.getAttribute('y1'))).toBeGreaterThan(
    Number(obscureLine?.getAttribute('y1')),
  );
});

test('renders an empty svg for an empty people list', () => {
  const { scale } = buildXScale(2);
  const people: Person[] = [];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
});

test("a lifespan line carries data-entity-id/data-entity-type so TimelineCanvas's delegated click listener can resolve it", () => {
  const { scale } = buildXScale(2);
  const people = [aristotle];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('data-entity-id')).toBe('Q868');
  expect(line?.getAttribute('data-entity-type')).toBe('person');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const people = [aristotle];
  const { container } = render(
    <PeopleLane
      people={people}
      xScale={scale}
      personRowFor={computeRowAssignment(people, [], []).personRowFor}
    />,
  );

  expect(container.querySelector('title')).toBeNull();
});

test('adopts a prerendered, unbound .d3-person node instead of destroying and recreating it', async () => {
  const { scale } = buildXScale(2);
  const { personRowFor } = computeRowAssignment([aristotle], [], []);

  // What a normal fresh mount computes for this exact input — the values
  // the adopted fixture below should end up corrected to.
  const reference = render(
    <PeopleLane
      people={[aristotle]}
      xScale={scale}
      personRowFor={personRowFor}
    />,
  );
  const referenceLine = reference.container.querySelector('.d3-line');
  const expectedX1 = referenceLine?.getAttribute('x1');
  const expectedY1 = referenceLine?.getAttribute('y1');
  reference.unmount();

  // Mount with no people first, so `g.people` exists but is empty, then
  // hand-inject a fixture matching mark-shape.ts's PERSON_MARK_SHAPE
  // directly into it — simulating the DOM a prerendered page would already
  // have before hydration's first real join runs. React never manages
  // g.people's children (D3 does, imperatively), so this bypasses React
  // entirely rather than fighting a second render's fresh DOM tree.
  const { container, rerender } = render(
    <PeopleLane people={[]} xScale={scale} personRowFor={personRowFor} />,
  );
  const peopleGroup = container.querySelector('g.people') as SVGGElement;
  peopleGroup.insertAdjacentHTML(
    'beforeend',
    `<g class="d3-person" style="opacity: 1">
      <rect class="d3-hit" data-entity-id="${aristotle.id}" data-entity-type="person"></rect>
      <line class="d3-line-ring-outer"></line>
      <line class="d3-line-ring-gap"></line>
      <line class="d3-line" x1="-999" y1="-999" data-entity-id="${aristotle.id}" data-entity-type="person"></line>
      <g class="d3-name-zoom"><text class="d3-name" x="-999" y="-999" data-entity-id="${aristotle.id}" data-entity-type="person">${aristotle.name}</text></g>
    </g>`,
  );
  const prerenderedNode = peopleGroup.querySelector(
    '.d3-person',
  ) as HTMLElement;
  prerenderedNode.setAttribute('data-test-marker', 'prerendered');

  rerender(
    <PeopleLane
      people={[aristotle]}
      xScale={scale}
      personRowFor={personRowFor}
    />,
  );

  // Same node, not a replacement — an exit+enter would have removed this
  // node and appended a fresh one instead.
  expect(container.querySelector('[data-test-marker="prerendered"]')).toBe(
    prerenderedNode,
  );
  expect(container.querySelectorAll('.d3-person')).toHaveLength(1);
  // enter is what sets opacity:0 to fade in from — update never touches
  // opacity, so an adopted node never flashes invisible.
  expect(prerenderedNode.style.opacity).not.toBe('0');

  const line = prerenderedNode.querySelector('.d3-line') as SVGLineElement;
  // x is applied instantly (not through the row-shift transition).
  expect(line.getAttribute('x1')).toBe(expectedX1);

  await new Promise((resolve) => setTimeout(resolve, 50));
  // y corrects too, once the row-shift transition settles.
  expect(line.getAttribute('y1')).toBe(expectedY1);
});

test('relative row order between two people is preserved when a third, differently-ranked, overlapping person is filtered out', () => {
  const { scale } = buildXScale(2);
  const overlappingSpan = { start: { year: -383 }, end: { year: -321 } };
  const famous: Person = {
    ...aristotle,
    id: 'Q-famous',
    lifespan: overlappingSpan,
    fameScore: 999,
    row: 0,
  };
  const middle: Person = {
    ...aristotle,
    id: 'Q-middle',
    lifespan: overlappingSpan,
    fameScore: 500,
    row: 1,
  };
  const obscure: Person = {
    ...aristotle,
    id: 'Q-obscure',
    lifespan: overlappingSpan,
    fameScore: 1,
    row: 2,
  };
  // Row assignment (data-pipeline's precomputed TimelineEntry.row, docs/adr/
  // 0005) is computed against the full 3-person universe — mirrors how
  // TimelineCanvas derives it from the unfiltered dataset — but only
  // famous/obscure are actually rendered, same as a filter hiding `middle`.
  const { personRowFor } = computeRowAssignment(
    [famous, middle, obscure],
    [],
    [],
  );

  const { container } = render(
    <PeopleLane
      people={[famous, obscure]}
      xScale={scale}
      personRowFor={personRowFor}
    />,
  );

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const famousLine = lines.find(
    (line) => line.getAttribute('data-entity-id') === 'Q-famous',
  );
  const obscureLine = lines.find(
    (line) => line.getAttribute('data-entity-id') === 'Q-obscure',
  );
  expect(Number(famousLine?.getAttribute('y1'))).toBeGreaterThan(
    Number(obscureLine?.getAttribute('y1')),
  );
});
