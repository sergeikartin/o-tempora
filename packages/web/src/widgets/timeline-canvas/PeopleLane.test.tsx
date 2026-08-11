import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { PeopleLane } from './PeopleLane';
import { buildXScale } from './options';
import type { Person } from '../../shared/types';

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
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  const lines = container.querySelectorAll('.d3-line');
  expect(lines).toHaveLength(2);
  const names = Array.from(container.querySelectorAll('.d3-name')).map((el) => el.textContent);
  expect(names).toEqual(expect.arrayContaining(['Aristotle', 'Julius Caesar']));
});

test("a person's name label sits above their lifespan line", () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle]} xScale={scale} />);

  const line = container.querySelector('.d3-line');
  const label = container.querySelector('.d3-name');
  expect(Number(label?.getAttribute('y'))).toBeLessThan(Number(line?.getAttribute('y1')));
});

test("a person's name label is colored to match their lifespan line", () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle]} xScale={scale} />);

  const line = container.querySelector('.d3-line');
  const label = container.querySelector('.d3-name');
  expect(label?.getAttribute('fill')).toBe(line?.getAttribute('stroke'));
});

test('renders no stems', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-stem')).toHaveLength(0);
});

test('two overlapping lifespans render at different y positions (separate rows)', () => {
  const { scale } = buildXScale(2);
  const overlappingCaesar: Person = {
    ...caesar,
    lifespan: { start: { year: -383 }, end: { year: -321 } },
  };
  const { container } = render(<PeopleLane people={[aristotle, overlappingCaesar]} xScale={scale} />);

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const ys = lines.map((line) => line.getAttribute('y1'));
  expect(new Set(ys).size).toBe(2);
});

test('two non-overlapping lifespans render at the same y position (same row)', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  const lines = Array.from(container.querySelectorAll('.d3-line'));
  const ys = lines.map((line) => line.getAttribute('y1'));
  expect(new Set(ys).size).toBe(1);
});

test('renders an empty svg for an empty people list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
});

test("a lifespan line carries data-entity-id/data-entity-type so TimelineCanvas's delegated click listener can resolve it", () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle]} xScale={scale} />);

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('data-entity-id')).toBe('Q868');
  expect(line?.getAttribute('data-entity-type')).toBe('person');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle]} xScale={scale} />);

  expect(container.querySelector('title')).toBeNull();
});
