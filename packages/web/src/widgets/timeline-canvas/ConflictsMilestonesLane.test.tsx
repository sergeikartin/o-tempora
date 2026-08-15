import { cleanup, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import { buildXScale, MILESTONE_CATEGORY_COLORS } from './options';
import { computeStaticConflictsMilestonesRows } from './map-to-items';
import { CONFLICT_COLOR } from '../../shared/config';
import type { Conflict, ConflictEvent, Milestone } from '../../shared/types';

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

const blackDeath: Milestone = {
  id: 'Q42005',
  name: 'Black Death',
  period: { start: { year: 1346 }, end: { year: 1353 } },
  category: 'medicine-health',
  regionTags: ['europe'],
  fameScore: 84,
  tagline: '1346-1353 pandemic in Eurasia and North Africa',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Black_Death',
};

const brazil: Milestone = {
  id: 'Q155',
  name: 'Brazil',
  at: { year: 1500 },
  category: 'expedition',
  regionTags: ['americas'],
  fameScore: 386,
  tagline: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('renders a range line for a Conflict (a Period)', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={conflicts} milestones={[]} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows(conflicts, [])} />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe('Korean War');
});

test('renders a point marker for a ConflictEvent (a PointInTime)', () => {
  const { scale } = buildXScale(2);
  const conflicts = [battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={conflicts} milestones={[]} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows(conflicts, [])} />,
  );

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe('Battle of Megiddo');
});

test('renders a point marker for a Milestone', () => {
  const { scale } = buildXScale(2);
  const milestones = [football];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={milestones} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], milestones)} />,
  );

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe('association football');
});

test('renders a range line, not a point marker, for a period-shaped Milestone', () => {
  const { scale } = buildXScale(2);
  const milestones = [blackDeath];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={milestones} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], milestones)} />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe('Black Death');
});

test("a period-shaped Milestone's range line keeps its own category color and data-entity-type, unlike a Conflict range", () => {
  const { scale } = buildXScale(2);
  const milestones = [blackDeath];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={milestones} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], milestones)} />,
  );

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('stroke')).toBe(MILESTONE_CATEGORY_COLORS[blackDeath.category]);
  expect(line?.getAttribute('data-entity-id')).toBe('Q42005');
  expect(line?.getAttribute('data-entity-type')).toBe('milestone');
});

test('renders an empty svg when both conflicts and milestones are empty', () => {
  const { scale } = buildXScale(2);
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={[]} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], [])} />,
  );

  expect(container.querySelectorAll('.d3-line, .d3-dot')).toHaveLength(0);
});

test('a Conflict range line and a ConflictEvent dot both carry data-entity-id/data-entity-type="conflict"', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar, battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={conflicts} milestones={[]} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows(conflicts, [])} />,
  );

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('data-entity-id')).toBe('Q8214');
  expect(line?.getAttribute('data-entity-type')).toBe('conflict');

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('data-entity-id')).toBe('Q217799');
  expect(dot?.getAttribute('data-entity-type')).toBe('conflict');
});

test('a Milestone dot carries data-entity-id/data-entity-type="milestone"', () => {
  const { scale } = buildXScale(2);
  const milestones = [football];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={milestones} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], milestones)} />,
  );

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('data-entity-id')).toBe('Q2736');
  expect(dot?.getAttribute('data-entity-type')).toBe('milestone');
});

test('no longer renders a native <title> tooltip element — replaced by the click-to-open drawer', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar, battleOfMegiddo];
  const milestones = [football];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={milestones}
      xScale={scale}
      staticRowOf={computeStaticConflictsMilestonesRows(conflicts, milestones)}
    />,
  );

  expect(container.querySelector('title')).toBeNull();
});

test('every Conflict marker (range or point) renders in the flat CONFLICT_COLOR, regardless of category', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar, battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={conflicts} milestones={[]} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows(conflicts, [])} />,
  );

  const line = container.querySelector('.d3-line');
  const dot = container.querySelector('.d3-dot');
  expect(line?.getAttribute('stroke')).toBe(CONFLICT_COLOR);
  expect(dot?.getAttribute('fill')).toBe(CONFLICT_COLOR);
});

test('a Milestone marker keeps its own category color, distinct from CONFLICT_COLOR', () => {
  const { scale } = buildXScale(2);
  const milestones = [football];
  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={milestones} xScale={scale} staticRowOf={computeStaticConflictsMilestonesRows([], milestones)} />,
  );

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('fill')).toBe(MILESTONE_CATEGORY_COLORS[football.category]);
  expect(dot?.getAttribute('fill')).not.toBe(CONFLICT_COLOR);
});

test('places two non-overlapping entries in the same row, two overlapping entries in different rows', () => {
  const { scale } = buildXScale(2);
  const sameRowConflicts = [koreanWar];
  const sameRowMilestones = [football];
  const { container: sameRow } = render(
    <ConflictsMilestonesLane
      conflicts={sameRowConflicts}
      milestones={sameRowMilestones}
      xScale={scale}
      staticRowOf={computeStaticConflictsMilestonesRows(sameRowConflicts, sameRowMilestones)}
    />,
  );
  const samePositions = Array.from(sameRow.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row'),
  );
  expect(new Set(samePositions).size).toBe(1);

  const overlappingMilestone: Milestone = { ...football, id: 'Q-overlap', at: { year: 1951 } };
  const overlappingConflicts = [koreanWar];
  const overlappingMilestones = [overlappingMilestone];
  const { container: differentRows } = render(
    <ConflictsMilestonesLane
      conflicts={overlappingConflicts}
      milestones={overlappingMilestones}
      xScale={scale}
      staticRowOf={computeStaticConflictsMilestonesRows(overlappingConflicts, overlappingMilestones)}
    />,
  );
  const overlappingPositions = Array.from(differentRows.querySelectorAll('.d3-range, .d3-point-group')).map((el) =>
    el.getAttribute('data-row'),
  );
  expect(new Set(overlappingPositions).size).toBe(2);
});

test('a Conflict and a Milestone compete for the same rows by fameScore — the more famous of two time-overlapping items lands in row 0', () => {
  const { scale } = buildXScale(2);
  const famousConflict: Conflict = { ...koreanWar, id: 'Q-famous-conflict', fameScore: 999 };
  const obscureMilestone: Milestone = { ...football, id: 'Q-obscure-milestone', at: { year: 1951 }, fameScore: 1 };
  const conflicts = [famousConflict];
  const milestones = [obscureMilestone];

  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={milestones}
      xScale={scale}
      staticRowOf={computeStaticConflictsMilestonesRows(conflicts, milestones)}
    />,
  );

  const famousRange = container.querySelector('.d3-range');
  const obscurePoint = Array.from(container.querySelectorAll('.d3-point-group')).find(
    (el) => el.querySelector('[data-entity-id="Q-obscure-milestone"]') !== null,
  );
  expect(famousRange?.getAttribute('data-row')).toBe('0');
  expect(obscurePoint?.getAttribute('data-row')).not.toBe('0');
});

test("stacks two milestones in the same year onto different rows, moving each row's dot and label down together", () => {
  const { scale } = buildXScale(2);
  const sameYear: Milestone = { ...brazil, id: 'Q999', at: { year: football.at.year } };
  const milestones = [football, sameYear];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      staticRowOf={computeStaticConflictsMilestonesRows([], milestones)}
    />,
  );

  const dotYs = Array.from(container.querySelectorAll('.d3-dot')).map((el) => el.getAttribute('cy'));
  expect(new Set(dotYs).size).toBe(2);

  const labelYs = Array.from(container.querySelectorAll('.d3-point-name')).map((el) => el.getAttribute('y'));
  expect(new Set(labelYs).size).toBe(2);
});

test('relative row order between a Conflict and a Milestone is preserved when a third, more-famous, overlapping item is filtered out', () => {
  const { scale } = buildXScale(2);
  const famousConflict: Conflict = { ...koreanWar, id: 'Q-famous', fameScore: 999 };
  const midMilestone: Milestone = { ...football, id: 'Q-mid', at: { year: 1951 }, fameScore: 500 };
  const obscureMilestone: Milestone = { ...football, id: 'Q-obscure', at: { year: 1952 }, fameScore: 1 };
  // Static map computed against the full universe (mirrors TimelineCanvas
  // deriving it from the unfiltered dataset); only mid/obscure are rendered,
  // same as a filter hiding the famous conflict.
  const staticRowOf = computeStaticConflictsMilestonesRows([famousConflict], [midMilestone, obscureMilestone]);

  const { container } = render(
    <ConflictsMilestonesLane conflicts={[]} milestones={[midMilestone, obscureMilestone]} xScale={scale} staticRowOf={staticRowOf} />,
  );

  const midRow = container.querySelector('[data-entity-id="Q-mid"]')?.closest('.d3-point-group')?.getAttribute('data-row');
  const obscureRow = container
    .querySelector('[data-entity-id="Q-obscure"]')
    ?.closest('.d3-point-group')
    ?.getAttribute('data-row');
  expect(Number(midRow)).toBeLessThan(Number(obscureRow));
});
