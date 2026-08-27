import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CONFLICT_COLOR } from '../../shared/config';
import type { Conflict, ConflictEvent, Milestone } from '../../shared/types';
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import { computeRowAssignment } from './map-to-items';
import { buildXScale, MILESTONE_CATEGORY_COLORS } from './options';

afterEach(cleanup);

const koreanWar: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['eastern-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battleOfMegiddo: ConflictEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['western-asia'],
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
  regionTags: ['western-europe'],
  fameScore: 84,
  tagline: '1346-1353 pandemic in Eurasia and North Africa',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Black_Death',
};

const brazil: Milestone = {
  id: 'Q155',
  name: 'Brazil',
  at: { year: 1500 },
  category: 'expedition',
  regionTags: ['northern-america'],
  fameScore: 386,
  tagline: 'country in South America',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
};

test('renders a range line for a Conflict (a Period)', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], conflicts, []).eventsRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe(
    'Korean War',
  );
});

test('renders a point marker for a ConflictEvent (a PointInTime)', () => {
  const { scale } = buildXScale(2);
  const conflicts = [battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], conflicts, []).eventsRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe(
    'Battle of Megiddo',
  );
});

test('renders a point marker for a Milestone', () => {
  const { scale } = buildXScale(2);
  const milestones = [football];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1);
  expect(container.querySelector('.d3-point-name')?.textContent).toBe(
    'association football',
  );
});

test('renders a range line, not a point marker, for a period-shaped Milestone', () => {
  const { scale } = buildXScale(2);
  const milestones = [blackDeath];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
  expect(container.querySelector('.d3-range-name')?.textContent).toBe(
    'Black Death',
  );
});

test("a period-shaped Milestone's range line keeps its own category color and data-entity-type, unlike a Conflict range", () => {
  const { scale } = buildXScale(2);
  const milestones = [blackDeath];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
  );

  const line = container.querySelector('.d3-line');
  expect(line?.getAttribute('stroke')).toBe(
    MILESTONE_CATEGORY_COLORS[blackDeath.category],
  );
  expect(line?.getAttribute('data-entity-id')).toBe('Q42005');
  expect(line?.getAttribute('data-entity-type')).toBe('milestone');
});

test('renders an empty svg when both conflicts and milestones are empty', () => {
  const { scale } = buildXScale(2);
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={[]}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], []).eventsRowFor}
    />,
  );

  expect(container.querySelectorAll('.d3-line, .d3-dot')).toHaveLength(0);
});

test('a Conflict range line and a ConflictEvent dot both carry data-entity-id/data-entity-type="conflict"', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar, battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], conflicts, []).eventsRowFor}
    />,
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
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
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
      eventsRowFor={
        computeRowAssignment([], conflicts, milestones).eventsRowFor
      }
    />,
  );

  expect(container.querySelector('title')).toBeNull();
});

test('every Conflict marker (range or point) renders in the flat CONFLICT_COLOR, regardless of category', () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar, battleOfMegiddo];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], conflicts, []).eventsRowFor}
    />,
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
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
  );

  const dot = container.querySelector('.d3-dot');
  expect(dot?.getAttribute('fill')).toBe(
    MILESTONE_CATEGORY_COLORS[football.category],
  );
  expect(dot?.getAttribute('fill')).not.toBe(CONFLICT_COLOR);
});

test('places two non-overlapping entries in the same row, two overlapping entries in different rows', () => {
  const { scale } = buildXScale(2);
  const sameRowConflicts = [{ ...koreanWar, row: 0 }];
  const sameRowMilestones = [{ ...football, row: 0 }];
  const { container: sameRow } = render(
    <ConflictsMilestonesLane
      conflicts={sameRowConflicts}
      milestones={sameRowMilestones}
      xScale={scale}
      eventsRowFor={
        computeRowAssignment([], sameRowConflicts, sameRowMilestones)
          .eventsRowFor
      }
    />,
  );
  const samePositions = Array.from(
    sameRow.querySelectorAll('.d3-range, .d3-point-group'),
  ).map((el) => el.getAttribute('data-row'));
  expect(new Set(samePositions).size).toBe(1);

  const overlappingMilestone: Milestone = {
    ...football,
    id: 'Q-overlap',
    at: { year: 1951 },
    row: 1,
  };
  const overlappingConflicts = [{ ...koreanWar, row: 0 }];
  const overlappingMilestones = [overlappingMilestone];
  const { container: differentRows } = render(
    <ConflictsMilestonesLane
      conflicts={overlappingConflicts}
      milestones={overlappingMilestones}
      xScale={scale}
      eventsRowFor={
        computeRowAssignment([], overlappingConflicts, overlappingMilestones)
          .eventsRowFor
      }
    />,
  );
  const overlappingPositions = Array.from(
    differentRows.querySelectorAll('.d3-range, .d3-point-group'),
  ).map((el) => el.getAttribute('data-row'));
  expect(new Set(overlappingPositions).size).toBe(2);
});

test('a Conflict and a Milestone compete for the same rows by fameScore — the more famous of two time-overlapping items lands in row 0', () => {
  const { scale } = buildXScale(2);
  const famousConflict: Conflict = {
    ...koreanWar,
    id: 'Q-famous-conflict',
    fameScore: 999,
    row: 0,
  };
  const obscureMilestone: Milestone = {
    ...football,
    id: 'Q-obscure-milestone',
    at: { year: 1951 },
    fameScore: 1,
    row: 1,
  };
  const conflicts = [famousConflict];
  const milestones = [obscureMilestone];

  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={
        computeRowAssignment([], conflicts, milestones).eventsRowFor
      }
    />,
  );

  const famousRange = container.querySelector('.d3-range');
  const obscurePoint = Array.from(
    container.querySelectorAll('.d3-point-group'),
  ).find(
    (el) => el.querySelector('[data-entity-id="Q-obscure-milestone"]') !== null,
  );
  expect(famousRange?.getAttribute('data-row')).toBe('0');
  expect(obscurePoint?.getAttribute('data-row')).not.toBe('0');
});

test("stacks two milestones in the same year onto different rows, moving each row's dot and label down together", () => {
  const { scale } = buildXScale(2);
  const sameYear: Milestone = {
    ...brazil,
    id: 'Q999',
    at: { year: football.at.year },
    row: 1,
  };
  const milestones = [{ ...football, row: 0 }, sameYear];
  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={computeRowAssignment([], [], milestones).eventsRowFor}
    />,
  );

  const dotYs = Array.from(container.querySelectorAll('.d3-dot')).map((el) =>
    el.getAttribute('cy'),
  );
  expect(new Set(dotYs).size).toBe(2);

  const labelYs = Array.from(container.querySelectorAll('.d3-point-name')).map(
    (el) => el.getAttribute('y'),
  );
  expect(new Set(labelYs).size).toBe(2);
});

test('adopts a prerendered, unbound .d3-range node instead of destroying and recreating it', async () => {
  const { scale } = buildXScale(2);
  const conflicts = [koreanWar];
  const { eventsRowFor } = computeRowAssignment([], conflicts, []);

  // What a normal fresh mount computes for this exact input — the values
  // the adopted fixture below should end up corrected to.
  const reference = render(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );
  const referenceLine = reference.container.querySelector('.d3-line');
  const expectedX1 = referenceLine?.getAttribute('x1');
  const expectedY1 = referenceLine?.getAttribute('y1');
  reference.unmount();

  // Mount with nothing first, so `g.ranges` exists but is empty, then
  // hand-inject a fixture matching mark-shape.ts's RANGE_MARK_SHAPE
  // directly into it — simulating the DOM a prerendered page would already
  // have before hydration's first real join runs. React never manages
  // g.ranges's children (D3 does, imperatively), so this bypasses React
  // entirely rather than fighting a second render's fresh DOM tree.
  const { container, rerender } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={[]}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );
  const rangesGroup = container.querySelector('g.ranges') as SVGGElement;
  rangesGroup.insertAdjacentHTML(
    'beforeend',
    `<g class="d3-range" style="opacity: 1">
      <rect class="d3-hit" data-entity-id="${koreanWar.id}" data-entity-type="conflict"></rect>
      <line class="d3-line-ring-outer"></line>
      <line class="d3-line-ring-gap"></line>
      <line class="d3-line" x1="-999" y1="-999" data-entity-id="${koreanWar.id}" data-entity-type="conflict"></line>
      <g class="d3-range-name-zoom"><text class="d3-range-name" x="-999" y="-999" data-entity-id="${koreanWar.id}" data-entity-type="conflict">${koreanWar.name}</text></g>
    </g>`,
  );
  const prerenderedNode = rangesGroup.querySelector('.d3-range') as HTMLElement;
  prerenderedNode.setAttribute('data-test-marker', 'prerendered');

  rerender(
    <ConflictsMilestonesLane
      conflicts={conflicts}
      milestones={[]}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );

  // Same node, not a replacement — an exit+enter would have removed this
  // node and appended a fresh one instead.
  expect(container.querySelector('[data-test-marker="prerendered"]')).toBe(
    prerenderedNode,
  );
  expect(container.querySelectorAll('.d3-range')).toHaveLength(1);
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

test('adopts a prerendered, unbound .d3-point-group node instead of destroying and recreating it', async () => {
  const { scale } = buildXScale(2);
  const milestones = [football];
  const { eventsRowFor } = computeRowAssignment([], [], milestones);

  // What a normal fresh mount computes for this exact input — the values
  // the adopted fixture below should end up corrected to.
  const reference = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );
  const referenceDot = reference.container.querySelector('.d3-dot');
  const expectedCx = referenceDot?.getAttribute('cx');
  const expectedCy = referenceDot?.getAttribute('cy');
  reference.unmount();

  // Mount with nothing first, so `g.points` exists but is empty, then
  // hand-inject a fixture matching mark-shape.ts's POINT_MARK_SHAPE
  // directly into it — simulating the DOM a prerendered page would already
  // have before hydration's first real join runs. React never manages
  // g.points's children (D3 does, imperatively), so this bypasses React
  // entirely rather than fighting a second render's fresh DOM tree.
  const { container, rerender } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={[]}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );
  const pointsGroup = container.querySelector('g.points') as SVGGElement;
  pointsGroup.insertAdjacentHTML(
    'beforeend',
    `<g class="d3-point-group" style="opacity: 1">
      <rect class="d3-hit" data-entity-id="${football.id}" data-entity-type="milestone"></rect>
      <circle class="d3-dot-ring-outer"></circle>
      <circle class="d3-dot-ring-gap"></circle>
      <circle class="d3-dot" cx="-999" cy="-999" data-entity-id="${football.id}" data-entity-type="milestone"></circle>
      <g class="d3-point-name-zoom"><text class="d3-point-name" x="-999" y="-999" data-entity-id="${football.id}" data-entity-type="milestone">${football.name}</text></g>
    </g>`,
  );
  const prerenderedNode = pointsGroup.querySelector(
    '.d3-point-group',
  ) as HTMLElement;
  prerenderedNode.setAttribute('data-test-marker', 'prerendered');

  rerender(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={milestones}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );

  // Same node, not a replacement — an exit+enter would have removed this
  // node and appended a fresh one instead.
  expect(container.querySelector('[data-test-marker="prerendered"]')).toBe(
    prerenderedNode,
  );
  expect(container.querySelectorAll('.d3-point-group')).toHaveLength(1);
  // enter is what sets opacity:0 to fade in from — update never touches
  // opacity, so an adopted node never flashes invisible.
  expect(prerenderedNode.style.opacity).not.toBe('0');

  const dot = prerenderedNode.querySelector('.d3-dot') as SVGCircleElement;
  // cx is applied instantly (not through the row-shift transition).
  expect(dot.getAttribute('cx')).toBe(expectedCx);

  await new Promise((resolve) => setTimeout(resolve, 50));
  // cy corrects too, once the row-shift transition settles.
  expect(dot.getAttribute('cy')).toBe(expectedCy);
});

test('relative row order between a Conflict and a Milestone is preserved when a third, more-famous, overlapping item is filtered out', () => {
  const { scale } = buildXScale(2);
  const famousConflict: Conflict = {
    ...koreanWar,
    id: 'Q-famous',
    fameScore: 999,
    row: 0,
  };
  const midMilestone: Milestone = {
    ...football,
    id: 'Q-mid',
    at: { year: 1951 },
    fameScore: 500,
    row: 1,
  };
  const obscureMilestone: Milestone = {
    ...football,
    id: 'Q-obscure',
    at: { year: 1952 },
    fameScore: 1,
    row: 2,
  };
  // Row assignment (data-pipeline's precomputed TimelineEntry.row, docs/adr/
  // 0005) computed against the full universe (mirrors TimelineCanvas
  // deriving it from the unfiltered dataset); only mid/obscure are rendered,
  // same as a filter hiding the famous conflict.
  const { eventsRowFor } = computeRowAssignment(
    [],
    [famousConflict],
    [midMilestone, obscureMilestone],
  );

  const { container } = render(
    <ConflictsMilestonesLane
      conflicts={[]}
      milestones={[midMilestone, obscureMilestone]}
      xScale={scale}
      eventsRowFor={eventsRowFor}
    />,
  );

  const midRow = container
    .querySelector('[data-entity-id="Q-mid"]')
    ?.closest('.d3-point-group')
    ?.getAttribute('data-row');
  const obscureRow = container
    .querySelector('[data-entity-id="Q-obscure"]')
    ?.closest('.d3-point-group')
    ?.getAttribute('data-row');
  expect(Number(midRow)).toBeLessThan(Number(obscureRow));
});
