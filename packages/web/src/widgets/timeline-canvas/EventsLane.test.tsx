import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { EventsLane } from './EventsLane';
import { buildXScale } from './options';
import type { Discovery } from '../../shared/types';

afterEach(cleanup);

const football: Discovery = {
  id: 'Q2736',
  name: 'association football',
  startYear: 1863,
  category: 'invention',
  regionTags: [],
  fameScore: 296,
  description: 'sport that is practiced between two teams of eleven players',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
};

const brazil: Discovery = {
  id: 'Q155',
  name: 'Brazil',
  startYear: 1500,
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

test('does not stack rows even for two discoveries in the same year', () => {
  const { scale } = buildXScale(2);
  const sameYear: Discovery = { ...brazil, id: 'Q999', startYear: football.startYear };
  const { container } = render(<EventsLane discoveries={[football, sameYear]} xScale={scale} />);

  const ys = Array.from(container.querySelectorAll('.d3-dot')).map((el) => el.getAttribute('cy'));
  expect(new Set(ys).size).toBe(1);
});

test('renders an empty svg for an empty discoveries list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<EventsLane discoveries={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
});
