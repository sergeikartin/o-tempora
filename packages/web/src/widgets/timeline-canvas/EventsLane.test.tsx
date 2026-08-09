import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { EventsLane } from './EventsLane';
import { buildXScale } from './options';
import type { Discovery } from '../../shared/types';

afterEach(cleanup);

const football: Discovery = {
  id: 'Q2736',
  name: 'association football',
  at: { year: 1863 },
  category: 'everyday-technology',
  regionTags: [],
  fameScore: 296,
  description: 'sport that is practiced between two teams of eleven players',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
};

const brazil: Discovery = {
  id: 'Q155',
  name: 'Brazil',
  at: { year: 1500 },
  category: 'exploration',
  regionTags: ['americas'],
  fameScore: 386,
  description: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('renders one point marker per discovery, with its name as the label', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<EventsLane discoveries={[football, brazil]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(2);
  const names = Array.from(container.querySelectorAll('.d3-point-name')).map((el) => el.textContent);
  expect(names).toEqual(expect.arrayContaining(['association football', 'Brazil']));
});

test('stacks two discoveries in the same year onto different rows, moving each row\'s dot and label down together', () => {
  const { scale } = buildXScale(2);
  const sameYear: Discovery = { ...brazil, id: 'Q999', at: { year: football.at.year } };
  const { container } = render(<EventsLane discoveries={[football, sameYear]} xScale={scale} />);

  // Each row's dot moves down with its own label — a lower row's dot no
  // longer sits at the same fixed y as row 0's.
  const dotYs = Array.from(container.querySelectorAll('.d3-dot')).map((el) => el.getAttribute('cy'));
  expect(new Set(dotYs).size).toBe(2);

  const labelYs = Array.from(container.querySelectorAll('.d3-point-name')).map((el) => el.getAttribute('y'));
  expect(new Set(labelYs).size).toBe(2);
});

test('renders an empty svg for an empty discoveries list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<EventsLane discoveries={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
});

test('a discovery dot carries data-entity-id/data-entity-type="discovery"', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<EventsLane discoveries={[football]} xScale={scale} />);

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('data-entity-id')).toBe('Q2736');
  expect(dot?.getAttribute('data-entity-type')).toBe('discovery');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<EventsLane discoveries={[football]} xScale={scale} />);

  expect(container.querySelector('title')).toBeNull();
});
