import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { ConflictsLane } from './ConflictsLane';
import { buildXScale } from './options';
import type { Conflict, ConflictEvent } from '../../shared/types';

afterEach(cleanup);

const koreanWar: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['east-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battleOfMegiddo: ConflictEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['middle-east'],
  fameScore: 120,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

test('renders a range line for a Conflict (a Period)', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<ConflictsLane conflicts={[koreanWar]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe('Korean War');
});

test('renders a point marker for a ConflictEvent (a PointInTime)', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<ConflictsLane conflicts={[battleOfMegiddo]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe('Battle of Megiddo');
});

test('places two non-overlapping entries in the same row, two overlapping in different rows', () => {
  const { scale } = buildXScale(2);
  const { container: sameRow } = render(<ConflictsLane conflicts={[koreanWar, battleOfMegiddo]} xScale={scale} />);
  const positions = Array.from(sameRow.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row'),
  );
  expect(new Set(positions).size).toBe(1);

  const overlappingBattle: ConflictEvent = { ...battleOfMegiddo, id: 'Q2', at: { year: 1951 } };
  const { container: differentRows } = render(<ConflictsLane conflicts={[koreanWar, overlappingBattle]} xScale={scale} />);
  const overlappingPositions = Array.from(differentRows.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row'),
  );
  expect(new Set(overlappingPositions).size).toBe(2);
});

test('renders an empty svg for an empty conflicts list', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<ConflictsLane conflicts={[]} xScale={scale} />);

  expect(container.querySelectorAll('.d3-line, .d3-dot')).toHaveLength(0);
});

test('a Conflict range line and a ConflictEvent dot both carry data-entity-id/data-entity-type="conflict"', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<ConflictsLane conflicts={[koreanWar, battleOfMegiddo]} xScale={scale} />);

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('data-entity-id')).toBe('Q8214');
  expect(line?.getAttribute('data-entity-type')).toBe('conflict');

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('data-entity-id')).toBe('Q217799');
  expect(dot?.getAttribute('data-entity-type')).toBe('conflict');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const { container } = render(<ConflictsLane conflicts={[koreanWar, battleOfMegiddo]} xScale={scale} />);

  expect(container.querySelector('title')).toBeNull();
});
