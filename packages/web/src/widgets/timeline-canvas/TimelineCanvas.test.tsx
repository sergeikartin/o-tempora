import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ConflictsMilestonesFilterValue } from '../../shared/config';
import type {
  ConflictEntry,
  Milestone,
  OccupationDomain,
  Person,
  Region,
} from '../../shared/types';
import * as mapToItems from './map-to-items';
import { zoomIn } from './options';
import { TimelineCanvas } from './TimelineCanvas';

afterEach(cleanup);

// The zoom-button animation runs via a real requestAnimationFrame loop
// (TimelineCanvas.tsx) — jsdom has no real rAF/paint fidelity to drive
// deterministically frame-by-frame (see this feature's spec, .scratch/
// zoom-filter-transitions/spec.md, on why this app doesn't commit
// frame-timing tests), so tests instead wait out real wall-clock time past
// the animation's own duration and assert on the settled end state, same as
// every other transition test in this codebase. No global.css is loaded in
// this test environment, so --motion-duration-base already reads as 0 here
// (motionDurationMs's own documented fallback) — the same near-instant path
// prefers-reduced-motion collapses to in production — but the real
// per-frame rAF loop still needs at least one real animation frame to
// observe it, hence the wait rather than a synchronous assertion.
async function waitOutZoomAnimation() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

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

const fixturePeople: Person[] = [aristotle];

const fixtureConflicts: ConflictEntry[] = [
  {
    id: 'Q8663',
    name: 'Korean War',
    period: { start: { year: 1950 }, end: { year: 1953 } },
    category: 'war',
    regionTags: ['eastern-asia'],
    fameScore: 143,
    tagline: 'war between North and South Korea, 1950–1953',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
  },
];

const fixtureMilestones: Milestone[] = [
  {
    id: 'Q2736',
    name: 'association football',
    at: { year: 1863 },
    category: 'everyday-technology',
    regionTags: [],
    fameScore: 296,
    tagline: 'sport that is practiced between two teams of eleven players',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
  },
];

const defaultFameScoreValues = { people: 90, conflicts: 100, milestones: 200 };
const defaultSelectedDomains: OccupationDomain[] = [];
const defaultSelectedRegions: Region[] = [];
const defaultSelectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[] =
  [];
const noopEntityClick = () => {};

test('renders both lanes, each populated from its own dataset', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  // Both People's lifespans and Conflicts' ranges are Periods and
  // share the literal `.d3-line` marker class — two total (Aristotle + the
  // Korean War) — so this counts each lane's own <svg> (People, then the
  // merged Conflicts+Milestones lane) rather than the whole page. Excludes
  // Minimap's own ridge <svg>, a third one that isn't a lane.
  const svgs = Array.from(container.querySelectorAll('svg')).filter(
    (svg) => svg.getAttribute('data-testid') !== 'minimap-ridge',
  );
  expect(svgs).toHaveLength(2);
  const [peopleSvg, conflictsMilestonesSvg] = svgs as [
    SVGSVGElement,
    SVGSVGElement,
  ];
  expect(peopleSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Aristotle
  expect(conflictsMilestonesSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Korean War
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1); // association football
  expect(container.querySelector('.d3-name')?.textContent).toBe('Aristotle');
});

test('computes Row Depth once and threads the same resolvers to every consumer', () => {
  const computeRowAssignment = vi.spyOn(mapToItems, 'computeRowAssignment');

  render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  // TimelineCanvas computes Row Depth exactly once, from the full
  // unfiltered datasets, and threads the resulting personRowFor/
  // eventsRowFor down to PeopleLane, ConflictsMilestonesLane, and Minimap —
  // no consumer is free to derive its own. A second call here would mean a
  // consumer (or a future one) recomputed row assignment independently,
  // which is exactly what let the Minimap's reported Row Depth drift out of
  // sync with the lanes before this was fixed (see ADR 0007's addendum).
  expect(computeRowAssignment).toHaveBeenCalledTimes(1);
  expect(computeRowAssignment).toHaveBeenCalledWith(
    fixturePeople,
    fixtureConflicts,
    fixtureMilestones,
  );

  computeRowAssignment.mockRestore();
});

test('the two lane sections and every year axis share the same rendered width', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  // People, and the merged Conflicts+Milestones lane — YearAxis is plain
  // HTML/CSS, no svg; excludes Minimap's own ridge <svg>, which
  // isn't a lane and (being CSS-sized, not width-attribute-sized) has no
  // `width` attribute to compare.
  const svgs = Array.from(container.querySelectorAll('svg')).filter(
    (svg) => svg.getAttribute('data-testid') !== 'minimap-ridge',
  );
  expect(svgs).toHaveLength(2);
  const svgWidthsPx = svgs.map((svg) => Number(svg.getAttribute('width')));
  const axisWidthsPx = Array.from(
    container.querySelectorAll('.year-axis-ruler'),
  ).map((ruler) =>
    parseFloat(
      ((ruler.parentElement as HTMLElement)?.style.width ?? '').replace(
        'px',
        '',
      ),
    ),
  );
  expect(new Set([...svgWidthsPx, ...axisWidthsPx]).size).toBe(1);
});

test('the full-height 25-year zebra striping is split into a BCE and a CE region with different tick phases', () => {
  // Regression: the zebra layer used to be one continuous CSS background
  // (a single phase for the whole timeline), which drifted out of
  // alignment with the axis's round-historical BCE tick labels — the same
  // bug as YearAxis's own ruler, fixed the same way (see options.ts's
  // BCE_QUARTER_CENTURY_TICK_PHASE_OFFSET_YEARS).
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const zebraBands = Array.from(
    container.querySelectorAll('[class*="zebraBand"]'),
  );
  expect(zebraBands).toHaveLength(2);
  const [bceBand, ceBand] = zebraBands as [HTMLElement, HTMLElement];
  expect(bceBand.style.getPropertyValue('--zebra-offset-px')).not.toBe(
    ceBand.style.getPropertyValue('--zebra-offset-px'),
  );
  // Widths sum to the full scrollable width (real PAN_MIN_YEAR-to-today
  // domain, always spanning both eras).
  const zebraLayer = container.querySelector(
    '[class*="zebraLayer"]',
  ) as HTMLElement;
  const totalWidth = parseFloat(zebraLayer.style.width);
  expect(
    parseFloat(bceBand.style.width) + parseFloat(ceBand.style.width),
  ).toBeCloseTo(totalWidth);
});

test('renders a single year axis, between People and Conflicts+Milestones', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(container.querySelectorAll('.year-axis-ruler')).toHaveLength(1);
});

test('mouse-dragging the scroll container pans it; releasing stops the pan', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: 100,
    writable: true,
  });

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 460,
    pointerId: 1,
  });
  expect(scrollContainer.scrollLeft).toBe(140); // dragged left by 40px -> content pans right

  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 300,
    pointerId: 1,
  });
  expect(scrollContainer.scrollLeft).toBe(140); // no longer dragging, so further moves are ignored
});

test('dragging the Minimap viewport rect scrolls the container, proportional to the (mocked) track width vs. the timeline width', async () => {
  const { container, findByTestId } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  // Minimap's own mount is deferred to idle time (TimelineCanvas.tsx's
  // isMinimapIdle) — findByTestId waits it out instead of assuming it's
  // there synchronously after render.
  const track = await findByTestId('minimap-track');
  const rect = await findByTestId('minimap-viewport-rect');
  // Minimap reads scrollLeft from React state (a prop), not a live
  // DOM ref — unlike the plain content-drag test above, so this drag's
  // start position is whatever TimelineCanvas already panned to on mount
  // (DEFAULT_VIEWPORT_START_YEAR), not a value this test can reset via a raw
  // scrollLeft property override.
  const startScrollLeft = scrollContainer.scrollLeft;
  // jsdom never lays anything out, so clientWidth is 0 by default — pinned
  // here the same way the "shared rendered width" test above reads
  // .yearAxis's inline style rather than trusting jsdom layout.
  Object.defineProperty(track, 'clientWidth', {
    value: 100,
    configurable: true,
  });
  const totalWidth = Number(
    (
      (container.querySelector('[class*="yearAxis"]') as HTMLElement | null)
        ?.style.width ?? ''
    ).replace('px', ''),
  );

  fireEvent.pointerDown(rect, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  // Dragged left (toward the timeline's start), away from the mounted
  // viewport's position near the domain's high end — keeps the expected
  // value comfortably inside [0, maxScrollLeft] with no clamping to reason
  // about.
  fireEvent.pointerMove(rect, {
    pointerType: 'mouse',
    clientX: 490,
    pointerId: 1,
  });

  // Mirrors Minimap's handleRectPointerMove formula (a hand-derived
  // expected value, same style as the plain content-drag test above): a
  // small rect move covers a large scrollLeft distance once totalWidth (a
  // multi-millennium timeline) vastly exceeds the 100px mocked track — the
  // whole reason this control exists.
  const rectWidthPx = Math.max(24, (100 / totalWidth) * 100);
  const maxScrollLeft = totalWidth - 100;
  const scrollLeftPerRectPx = maxScrollLeft / (100 - rectWidthPx);
  const expectedScrollLeft = Math.min(
    Math.max(startScrollLeft - 10 * scrollLeftPerRectPx, 0),
    maxScrollLeft,
  );
  expect(scrollContainer.scrollLeft).toBeCloseTo(expectedScrollLeft);

  fireEvent.pointerUp(rect, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.pointerMove(rect, {
    pointerType: 'mouse',
    clientX: 300,
    pointerId: 1,
  });
  expect(scrollContainer.scrollLeft).toBeCloseTo(expectedScrollLeft); // no longer dragging
});

test('a mousedown on the scroll container content still pans it — the custom scrollbar is a separate element, not a geometry guard on the same one', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: 100,
    writable: true,
  });

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 460,
    pointerId: 1,
  });
  expect(scrollContainer.scrollLeft).toBe(140);
});

test('clicking the Minimap track outside the viewport rect jumps the viewport toward the click position', async () => {
  const { container, findByTestId } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  // Minimap's own mount is deferred to idle time (TimelineCanvas.tsx's
  // isMinimapIdle) — findByTestId waits it out instead of assuming it's
  // there synchronously after render.
  const track = await findByTestId('minimap-track');
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: 0,
    writable: true,
  });
  Object.defineProperty(track, 'clientWidth', {
    value: 200,
    configurable: true,
  });
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 200,
      height: 14,
      right: 200,
      bottom: 14,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  const totalWidth = Number(
    (
      (container.querySelector('[class*="yearAxis"]') as HTMLElement | null)
        ?.style.width ?? ''
    ).replace('px', ''),
  );

  fireEvent.pointerDown(track, {
    pointerType: 'mouse',
    button: 0,
    clientX: 100,
    pointerId: 2,
  });

  const maxScrollLeft = totalWidth - 200;
  const expectedScrollLeft = Math.min(
    Math.max((100 / 200) * totalWidth - 100, 0),
    maxScrollLeft,
  );
  expect(scrollContainer.scrollLeft).toBeCloseTo(expectedScrollLeft);
});

test('releasing a drag suppresses the click event that follows it', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={onEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const line = container.querySelector('.d3-line') as SVGLineElement;

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 460,
    pointerId: 1,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  // Browsers still fire a native click at the release point after a real
  // drag, regardless of how far the pointer moved in between — simulated
  // here landing directly on a mark, which is exactly the case a user
  // reported: panning past a person's line unintentionally opened it.
  fireEvent.click(line);

  expect(onEntityClick).not.toHaveBeenCalled();
});

test('a click preceded only by sub-threshold pointer jitter still registers', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={onEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const line = container.querySelector('.d3-line') as SVGLineElement;

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 502,
    pointerId: 1,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.click(line);

  expect(onEntityClick).toHaveBeenCalledWith({
    id: 'Q868',
    entityType: 'person',
  });
});

test('touch pointers do not trigger drag-to-pan — native swipe-to-scroll already handles them', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: 100,
    writable: true,
  });

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    clientX: 460,
    pointerId: 1,
  });
  expect(scrollContainer.scrollLeft).toBe(100);
});

test('a single touch pointer does not start a pinch — zoom only engages once a second concurrent touch is down', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const initialWidth = personLineWidth(container);

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 400,
    clientY: 300,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 300,
    clientY: 300,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'touch', pointerId: 1 });

  expect(personLineWidth(container)).toBe(initialWidth);
});

test('a mouse pointer never starts a pinch, even alongside a stray touch pointer id — only two concurrent non-mouse pointers engage it', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const initialWidth = personLineWidth(container);
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: 100,
    writable: true,
  });

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 460,
    pointerId: 1,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });

  expect(scrollContainer.scrollLeft).toBe(140); // drag-to-pan, unaffected by pinch tracking
  expect(personLineWidth(container)).toBe(initialWidth); // never zoomed
});

test('a two-finger touch pinch scales pixelsPerYear by the live distance ratio, committing once the first finger lifts', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const initialWidth = personLineWidth(container);

  // Two touches start 100px apart, spread to 200px apart (a 2x distance
  // ratio) — mirrors pinching outward to zoom in.
  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 400,
    clientY: 300,
  });
  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    pointerId: 2,
    clientX: 500,
    clientY: 300,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 350,
    clientY: 300,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    pointerId: 2,
    clientX: 550,
    clientY: 300,
  });
  // The first finger lifting is gesture end — commits immediately (no
  // rAF-driven animation, unlike button-zoom), so no wait is needed.
  fireEvent.pointerUp(scrollContainer, { pointerType: 'touch', pointerId: 1 });

  expect(personLineWidth(container)).toBeCloseTo(initialWidth * 2);

  // The second finger's own pointerup afterward is a no-op — the gesture
  // already committed and its state was cleared.
  fireEvent.pointerUp(scrollContainer, { pointerType: 'touch', pointerId: 2 });
  expect(personLineWidth(container)).toBeCloseTo(initialWidth * 2);
});

test('a two-finger touch pinch pinching inward (fingers moving closer) zooms out', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  const initialWidth = personLineWidth(container);

  // Two touches start 200px apart, pinch together to 100px apart (a 0.5x
  // distance ratio).
  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 350,
    clientY: 300,
  });
  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'touch',
    pointerId: 2,
    clientX: 550,
    clientY: 300,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 400,
    clientY: 300,
  });
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'touch',
    pointerId: 2,
    clientX: 500,
    clientY: 300,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'touch', pointerId: 2 });

  expect(personLineWidth(container)).toBeCloseTo(initialWidth * 0.5);
});

function personLineWidth(container: HTMLElement): number {
  const [peopleSvg] = Array.from(container.querySelectorAll('svg')) as [
    SVGSVGElement,
  ];
  const line = peopleSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

function conflictLineWidth(container: HTMLElement): number {
  const svgs = Array.from(container.querySelectorAll('svg')).filter(
    (svg) => svg.getAttribute('data-testid') !== 'minimap-ridge',
  );
  const [, conflictsMilestonesSvg] = svgs as [SVGSVGElement, SVGSVGElement];
  const line = conflictsMilestonesSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

function yearAxisDecadeTickPx(container: HTMLElement): number {
  const ruler = container.querySelector('.year-axis-ruler') as HTMLElement;
  return parseFloat(ruler.style.getPropertyValue('--decade-tick-px'));
}

// A single zoom step's exact multiplier, derived the same way TimelineCanvas
// itself computes it (rather than duplicating ZOOM_STEP as a hand-copied
// literal) — 10 is an arbitrary value safely inside pixelsPerYearBounds(0)
// (jsdom's clientWidth), so neither call clamps and the ratio is exact.
const ZOOM_STEP_RATIO = zoomIn(10, 0) / 10;

test('the zoom-in button animates rendered lines wider, landing exactly on the target pixelsPerYear once it resolves; zoom-out narrows them back', async () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const initialWidth = personLineWidth(container);

  fireEvent.click(getByLabelText('Zoom in'));
  await waitOutZoomAnimation();
  const zoomedInWidth = personLineWidth(container);
  expect(zoomedInWidth).toBeCloseTo(initialWidth * ZOOM_STEP_RATIO);

  fireEvent.click(getByLabelText('Zoom out'));
  fireEvent.click(getByLabelText('Zoom out'));
  await waitOutZoomAnimation();
  const zoomedOutWidth = personLineWidth(container);
  expect(zoomedOutWidth).toBeLessThan(zoomedInWidth);
});

test('a second zoom-in click fired while the first animation is still in flight retargets to two compounded steps, not the stale first target', async () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const initialWidth = personLineWidth(container);

  // Fired synchronously back-to-back, before the first click's animation
  // has had a chance to resolve — the second click's retarget must chain
  // off the first click's already-requested target (two full steps
  // compounded), not restart from a stale target or the original start.
  fireEvent.click(getByLabelText('Zoom in'));
  fireEvent.click(getByLabelText('Zoom in'));
  await waitOutZoomAnimation();

  const finalWidth = personLineWidth(container);
  expect(finalWidth).toBeCloseTo(
    initialWidth * ZOOM_STEP_RATIO * ZOOM_STEP_RATIO,
  );
});

test('a zoom animation moves People, Conflicts+Milestones marks, and the Year Axis ticks together, all landing on the same target pixelsPerYear', async () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const initialPersonWidth = personLineWidth(container);
  const initialConflictWidth = conflictLineWidth(container);
  const initialTickPx = yearAxisDecadeTickPx(container);

  fireEvent.click(getByLabelText('Zoom in'));
  await waitOutZoomAnimation();

  expect(personLineWidth(container)).toBeCloseTo(
    initialPersonWidth * ZOOM_STEP_RATIO,
  );
  expect(conflictLineWidth(container)).toBeCloseTo(
    initialConflictWidth * ZOOM_STEP_RATIO,
  );
  expect(yearAxisDecadeTickPx(container)).toBeCloseTo(
    initialTickPx * ZOOM_STEP_RATIO,
  );
});

test("Minimap's viewport rect reflects the new range once a zoom animation settles, not a stale pre-zoom one, even after an interrupted (double-clicked) animation", async () => {
  const { getByLabelText, findByTestId } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  // Minimap's own mount is deferred to idle time (TimelineCanvas.tsx's
  // isMinimapIdle) — findByTestId waits it out instead of assuming it's
  // there synchronously after render.
  const rect = await findByTestId('minimap-viewport-rect');
  const initialWidthPct = parseFloat(rect.style.width);

  // Two rapid clicks — the second interrupts/retargets the first — so this
  // also covers "immediately after an interrupted animation", not just a
  // single settled zoom.
  fireEvent.click(getByLabelText('Zoom in'));
  fireEvent.click(getByLabelText('Zoom in'));
  await waitOutZoomAnimation();

  // Zooming in widens totalWidth against the same viewportWidthPx, so the
  // rect representing "how much of the timeline is on screen" shrinks — a
  // stale (pre-zoom) rect would still show the old, wider percentage.
  expect(parseFloat(rect.style.width)).toBeLessThan(initialWidthPct);
});

test('zooming does not change which entities are rendered — density is gated by fameScoreValues, not pixelsPerYear', () => {
  const lowFamePerson: Person = {
    ...aristotle,
    id: 'Q-low-fame',
    name: 'Low Fame Person',
    fameScore: 76, // below the 90 people floor in defaultFameScoreValues
  };

  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={[lowFamePerson]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  for (let i = 0; i < 5; i++) {
    fireEvent.click(getByLabelText('Zoom in'));
  }

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
});

test('a person below fameScoreValues.people is excluded; raising it reveals them', () => {
  const lowFamePerson: Person = {
    ...aristotle,
    id: 'Q-low-fame',
    name: 'Low Fame Person',
    fameScore: 76,
  };

  const { container, rerender } = render(
    <TimelineCanvas
      people={[lowFamePerson]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  rerender(
    <TimelineCanvas
      people={[lowFamePerson]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={{ ...defaultFameScoreValues, people: 75 }}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
});

test('a person outside an active Occupation Domain filter is excluded; clearing the filter reveals them', () => {
  const { container, rerender } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={['science-technology']}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  rerender(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
});

test('an item outside an active Region filter is excluded; clearing the filter reveals it', () => {
  const { container, rerender } = render(
    <TimelineCanvas
      people={[]}
      conflicts={fixtureConflicts}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={['northern-africa']}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0); // Korean War is tagged eastern-asia, not northern-africa

  rerender(
    <TimelineCanvas
      people={[]}
      conflicts={fixtureConflicts}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={['eastern-asia']}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
});

test('an item with no region tags is excluded once a Region filter is active', () => {
  const { container } = render(
    <TimelineCanvas
      people={[]}
      conflicts={[]}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={['western-europe']}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  // fixtureMilestones' football entry has an empty regionTags array — it
  // can't match any non-empty region selection.
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(0);
});

test('the People lane defaults its vertical scroll to the bottom (axis-adjacent edge) whenever the visible person set changes', () => {
  const { container, rerender } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const peopleLane = container.querySelector(
    '[class*="peopleLane"]',
  ) as HTMLElement;
  Object.defineProperty(peopleLane, 'scrollHeight', {
    value: 500,
    configurable: true,
  });
  Object.defineProperty(peopleLane, 'scrollTop', { value: 0, writable: true });

  // Changing the People fame-score floor gives filteredPeople a new
  // reference even though Aristotle still clears it — that's the trigger
  // the scroll-anchor effect keys off.
  rerender(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={{ ...defaultFameScoreValues, people: 80 }}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(peopleLane.scrollTop).toBe(500);
});

test('the Conflicts+Milestones lane defaults its vertical scroll to the top (axis-adjacent edge) whenever its visible item set changes', () => {
  const { container, rerender } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );
  const conflictsMilestonesLane = container.querySelector(
    '[class*="conflictsMilestonesLane"]',
  ) as HTMLElement;
  Object.defineProperty(conflictsMilestonesLane, 'scrollTop', {
    value: 300,
    writable: true,
  });

  rerender(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={{ ...defaultFameScoreValues, conflicts: 90 }}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={noopEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(conflictsMilestonesLane.scrollTop).toBe(0);
});

test('clicking a mark reports its entity id/type via onEntityClick, resolved through the delegated listener', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={onEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const line = container.querySelector('.d3-line') as SVGLineElement;
  fireEvent.click(line);

  expect(onEntityClick).toHaveBeenCalledWith({
    id: 'Q868',
    entityType: 'person',
  });
});

test('clicking empty canvas space (no data-entity-id ancestor) does not call onEntityClick', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={onEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const scrollContainer = container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  fireEvent.click(scrollContainer);

  expect(onEntityClick).not.toHaveBeenCalled();
});

test('a mark with an unrecognized data-entity-type is ignored rather than reported (fails closed, not silently as a milestone)', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={defaultSelectedDomains}
      selectedRegions={defaultSelectedRegions}
      selectedConflictsMilestonesValues={
        defaultSelectedConflictsMilestonesValues
      }
      onEntityClick={onEntityClick}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const line = container.querySelector('.d3-line') as SVGLineElement;
  line.setAttribute('data-entity-type', 'not-a-real-type');
  fireEvent.click(line);

  expect(onEntityClick).not.toHaveBeenCalled();
});
