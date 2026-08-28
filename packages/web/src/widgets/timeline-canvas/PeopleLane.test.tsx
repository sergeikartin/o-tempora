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

// Prerendered-node adoption (seeding, enter/update/exit lifecycle) is a
// mark-join.ts concern now, covered generically by mark-join.test.ts rather
// than per-lane — this file keeps only PeopleLane-specific geometry/wiring
// assertions.

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
