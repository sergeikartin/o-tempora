import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { MilestonesLane } from './MilestonesLane';
import { buildXScale } from './options';
import type { Milestone } from '../../shared/types';

afterEach(cleanup);

const football: Milestone = {
  id: 'Q2736',
  name: 'association football',
  at: { year: 1863 },
  category: 'everyday-technology',
  regionTags: [],
  fameScore: 296,
  tagline: 'sport that is practiced between two teams of eleven players',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
};

const brazil: Milestone = {
  id: 'Q155',
  name: 'Brazil',
  at: { year: 1500 },
  category: 'exploration',
  regionTags: ['americas'],
  fameScore: 386,
  tagline: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('renders one point marker per milestone, with its name as the label', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<MilestonesLane milestones={[football, brazil]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(2);
  const names = Array.from(container.querySelectorAll('.d3-point-name')).map((el) => el.textContent);
  expect(names).toEqual(expect.arrayContaining(['association football', 'Brazil']));
});

test('stacks two milestones in the same year onto different rows, moving each row\'s dot and label down together', () => {
  const { scale } = buildXScale(2);
  const sameYear: Milestone = { ...brazil, id: 'Q999', at: { year: football.at.year } };
  const { container } = render(<MilestonesLane milestones={[football, sameYear]} xScale={scale} />);

  // Each row's dot moves down with its own label — a lower row's dot no
  // longer sits at the same fixed y as row 0's.
  const dotYs = Array.from(container.querySelectorAll('.d3-dot')).map((el) => el.getAttribute('cy'));
  expect(new Set(dotYs).size).toBe(2);

  const labelYs = Array.from(container.querySelectorAll('.d3-point-name')).map((el) => el.getAttribute('y'));
  expect(new Set(labelYs).size).toBe(2);
});

test('renders an empty svg for an empty milestones list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<MilestonesLane milestones={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
});

test('a milestone dot carries data-entity-id/data-entity-type="milestone"', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<MilestonesLane milestones={[football]} xScale={scale} />);

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('data-entity-id')).toBe('Q2736');
  expect(dot?.getAttribute('data-entity-type')).toBe('milestone');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<MilestonesLane milestones={[football]} xScale={scale} />);

  expect(container.querySelector('title')).toBeNull();
});
