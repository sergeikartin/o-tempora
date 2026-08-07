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
  description: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const caesar: Person = {
  id: 'Q1048',
  name: 'Julius Caesar',
  lifespan: { start: { year: -100 }, end: { year: -44 } },
  occupationDomain: 'institutions',
  regionTags: [],
  fameScore: 400,
  description: 'Roman general and statesman',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Julius_Caesar',
  reignPeriods: [{ start: { year: -49 }, end: { year: -44 }, title: 'Dictator' }],
};

test('renders one lifespan bar per person, with the name inside it', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  const bars = container.querySelectorAll('.d3-bar');
  expect(bars).toHaveLength(2);
  const names = Array.from(container.querySelectorAll('.d3-name')).map((el) => el.textContent);
  expect(names).toEqual(expect.arrayContaining(['Aristotle', 'Julius Caesar']));
});

test('renders one reign-period stripe per reignPeriod, none for a person without any', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-stripe')).toHaveLength(1);
});

test('two overlapping lifespans render at different y positions (separate rows)', () => {
  const { scale } = buildXScale(2);
  const overlappingCaesar: Person = {
    ...caesar,
    lifespan: { start: { year: -383 }, end: { year: -321 } },
    reignPeriods: undefined,
  };
  const { container } = render(<PeopleLane people={[aristotle, overlappingCaesar]} xScale={scale} />);

  const bars = Array.from(container.querySelectorAll('.d3-bar'));
  const ys = bars.map((bar) => bar.getAttribute('y'));
  expect(new Set(ys).size).toBe(2);
});

test('two non-overlapping lifespans render at the same y position (same row)', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[aristotle, caesar]} xScale={scale} />);

  const bars = Array.from(container.querySelectorAll('.d3-bar'));
  const ys = bars.map((bar) => bar.getAttribute('y'));
  expect(new Set(ys).size).toBe(1);
});

test('renders an empty svg for an empty people list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<PeopleLane people={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-bar')).toHaveLength(0);
});
