import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { WarsLane } from './WarsLane';
import { buildXScale } from './options';
import type { War } from '../../shared/types';

afterEach(cleanup);

const koreanWar: War = {
  id: 'Q8214',
  name: 'Korean War',
  startYear: 1950,
  endYear: 1953,
  category: 'war',
  regionTags: ['east-asia'],
  fameScore: 350,
  description: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battleOfMegiddo: War = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  startYear: -1457,
  category: 'war',
  regionTags: ['middle-east'],
  fameScore: 120,
  description: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

test('renders a range line for a war with an endYear', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<WarsLane wars={[koreanWar]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe('Korean War');
});

test('renders a point marker for an entry without an endYear', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<WarsLane wars={[battleOfMegiddo]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe('Battle of Megiddo');
});

test('places two non-overlapping entries in the same row, two overlapping in different rows', () => {
  const { scale } = buildXScale(2);
  const { container: sameRow } = render(<WarsLane wars={[koreanWar, battleOfMegiddo]} xScale={scale} />);
  const positions = Array.from(sameRow.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row-y'),
  );
  expect(new Set(positions).size).toBe(1);

  const overlappingBattle: War = { ...battleOfMegiddo, id: 'Q2', startYear: 1951 };
  const { container: differentRows } = render(<WarsLane wars={[koreanWar, overlappingBattle]} xScale={scale} />);
  const overlappingPositions = Array.from(differentRows.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row-y'),
  );
  expect(new Set(overlappingPositions).size).toBe(2);
});

test('renders an empty svg for an empty wars list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<WarsLane wars={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-line, .d3-dot')).toHaveLength(0);
});
