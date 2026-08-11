import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach, vi } from 'vitest';
import { TimelineCanvas } from './TimelineCanvas';
import type { Milestone, Person, ConflictEntry } from '../../shared/types';

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

const fixturePeople: Person[] = [aristotle];

const fixtureConflicts: ConflictEntry[] = [
  {
    id: 'Q8663',
    name: 'Korean War',
    period: { start: { year: 1950 }, end: { year: 1953 } },
    category: 'war',
    regionTags: ['east-asia'],
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
const noopEntityClick = () => {};

test('renders all three lanes, each populated from its own dataset', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );

  // Both People's lifespans and Conflicts' ranges are Periods and
  // share the literal `.d3-line` marker class — two total (Aristotle + the
  // Korean War) — so this counts each lane's own <svg> (rendered in People,
  // Conflicts, Milestones order) rather than the whole page.
  const svgs = Array.from(container.querySelectorAll('svg'));
  expect(svgs).toHaveLength(3);
  const [peopleSvg, conflictsSvg] = svgs as [SVGSVGElement, SVGSVGElement, SVGSVGElement];
  expect(peopleSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Aristotle
  expect(conflictsSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Korean War
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1); // association football
  expect(container.querySelector('.d3-name')?.textContent).toBe('Aristotle');
});

test('the three lane sections and the year axis share the same rendered width', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );

  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(3); // People, Conflicts, Milestones — YearAxis is plain HTML/CSS, no svg
  const svgWidthsPx = Array.from(svgs).map((svg) => Number(svg.getAttribute('width')));
  const axisWidthPx = parseFloat(
    ((container.querySelector('.year-axis-ruler')?.parentElement as HTMLElement)?.style.width ?? '').replace('px', ''),
  );
  expect(new Set([...svgWidthsPx, axisWidthPx]).size).toBe(1);
});

test('mouse-dragging the scroll container pans it; releasing stops the pan', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, writable: true });

  fireEvent.pointerDown(scrollContainer, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 460, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBe(140); // dragged left by 40px -> content pans right

  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 300, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBe(140); // no longer dragging, so further moves are ignored
});

test('dragging the custom scrollbar thumb scrolls the container, proportional to the (mocked) track width vs. the timeline width', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  const track = container.querySelector('[class*="scrollbarTrack"]') as HTMLElement;
  const thumb = container.querySelector('[class*="scrollbarThumb"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 0, writable: true });
  // jsdom never lays anything out, so clientWidth is 0 by default — pinned
  // here the same way the "shared rendered width" test above reads
  // .yearAxis's inline style rather than trusting jsdom layout.
  Object.defineProperty(track, 'clientWidth', { value: 100, configurable: true });
  const totalWidth = Number(
    ((container.querySelector('[class*="yearAxis"]') as HTMLElement | null)?.style.width ?? '').replace('px', ''),
  );

  fireEvent.pointerDown(thumb, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(thumb, { pointerType: 'mouse', clientX: 510, pointerId: 1 });

  // Mirrors handleThumbPointerMove's own formula (a hand-derived expected
  // value, same style as the plain content-drag test above): a small thumb
  // move covers a large scrollLeft distance once totalWidth (a
  // multi-millennium timeline) vastly exceeds the 100px mocked track — the
  // whole reason a scrollbar exists here.
  const thumbWidthPx = Math.max(24, (100 / totalWidth) * 100);
  const maxScrollLeft = totalWidth - 100;
  const expectedScrollLeft = (10 * maxScrollLeft) / (100 - thumbWidthPx);
  expect(scrollContainer.scrollLeft).toBeCloseTo(expectedScrollLeft);

  fireEvent.pointerUp(thumb, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.pointerMove(thumb, { pointerType: 'mouse', clientX: 300, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBeCloseTo(expectedScrollLeft); // no longer dragging
});

test('a mousedown on the scroll container content still pans it — the custom scrollbar is a separate element, not a geometry guard on the same one', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, writable: true });

  fireEvent.pointerDown(scrollContainer, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 460, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBe(140);
});

test('clicking the scrollbar track outside the thumb jumps the viewport toward the click position', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  const track = container.querySelector('[class*="scrollbarTrack"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 0, writable: true });
  Object.defineProperty(track, 'clientWidth', { value: 200, configurable: true });
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 14, right: 200, bottom: 14, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  const totalWidth = Number(
    ((container.querySelector('[class*="yearAxis"]') as HTMLElement | null)?.style.width ?? '').replace('px', ''),
  );

  fireEvent.pointerDown(track, { pointerType: 'mouse', button: 0, clientX: 100, pointerId: 2 });

  const maxScrollLeft = totalWidth - 200;
  const expectedScrollLeft = Math.min(Math.max((100 / 200) * totalWidth - 100, 0), maxScrollLeft);
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
      onEntityClick={onEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  const line = container.querySelector('.d3-line') as SVGLineElement;

  fireEvent.pointerDown(scrollContainer, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 460, pointerId: 1 });
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
      onEntityClick={onEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  const line = container.querySelector('.d3-line') as SVGLineElement;

  fireEvent.pointerDown(scrollContainer, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 502, pointerId: 1 });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  fireEvent.click(line);

  expect(onEntityClick).toHaveBeenCalledWith({ id: 'Q868', entityType: 'person' });
});

test('touch pointers do not trigger drag-to-pan — native swipe-to-scroll already handles them', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, writable: true });

  fireEvent.pointerDown(scrollContainer, { pointerType: 'touch', clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(scrollContainer, { pointerType: 'touch', clientX: 460, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBe(100);
});

function personLineWidth(container: HTMLElement): number {
  const [peopleSvg] = Array.from(container.querySelectorAll('svg')) as [SVGSVGElement];
  const line = peopleSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

test('the zoom-in button widens rendered lines; zoom-out narrows them back', () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );

  const initialWidth = personLineWidth(container);

  fireEvent.click(getByLabelText('Zoom in'));
  const zoomedInWidth = personLineWidth(container);
  expect(zoomedInWidth).toBeGreaterThan(initialWidth);

  fireEvent.click(getByLabelText('Zoom out'));
  fireEvent.click(getByLabelText('Zoom out'));
  const zoomedOutWidth = personLineWidth(container);
  expect(zoomedOutWidth).toBeLessThan(zoomedInWidth);
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
      onEntityClick={noopEntityClick}
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
      onEntityClick={noopEntityClick}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  rerender(
    <TimelineCanvas
      people={[lowFamePerson]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={{ ...defaultFameScoreValues, people: 75 }}
      onEntityClick={noopEntityClick}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
});

test('clicking a mark reports its entity id/type via onEntityClick, resolved through the delegated listener', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={onEntityClick}
    />,
  );

  const line = container.querySelector('.d3-line') as SVGLineElement;
  fireEvent.click(line);

  expect(onEntityClick).toHaveBeenCalledWith({ id: 'Q868', entityType: 'person' });
});

test('clicking empty canvas space (no data-entity-id ancestor) does not call onEntityClick', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      conflicts={fixtureConflicts}
      milestones={fixtureMilestones}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={onEntityClick}
    />,
  );

  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
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
      onEntityClick={onEntityClick}
    />,
  );

  const line = container.querySelector('.d3-line') as SVGLineElement;
  line.setAttribute('data-entity-type', 'not-a-real-type');
  fireEvent.click(line);

  expect(onEntityClick).not.toHaveBeenCalled();
});
