import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach, vi } from 'vitest';
import { TimelineCanvas } from './TimelineCanvas';
import type { Discovery, Person, WarsAndConflictsEntry } from '../../shared/types';

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

const fixturePeople: Person[] = [aristotle];

const fixtureWars: WarsAndConflictsEntry[] = [
  {
    id: 'Q8663',
    name: 'Korean War',
    period: { start: { year: 1950 }, end: { year: 1953 } },
    category: 'war',
    regionTags: ['east-asia'],
    fameScore: 143,
    description: 'war between North and South Korea, 1950–1953',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
  },
];

const fixtureDiscoveries: Discovery[] = [
  {
    id: 'Q2736',
    name: 'association football',
    at: { year: 1863 },
    category: 'everyday-technology',
    regionTags: [],
    fameScore: 296,
    description: 'sport that is practiced between two teams of eleven players',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
  },
];

const defaultFameScoreValues = { people: 90, wars: 100, discoveries: 200 };
const noopEntityClick = () => {};

test('renders all three lanes, each populated from its own dataset', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );

  // Both People's lifespans and Wars & Conflicts' ranges are Periods and
  // share the literal `.d3-line` marker class — two total (Aristotle + the
  // Korean War) — so this counts each lane's own <svg> (rendered in People,
  // Wars & Conflicts, Events & Inventions order) rather than the whole page.
  const svgs = Array.from(container.querySelectorAll('svg'));
  expect(svgs).toHaveLength(3);
  const [peopleSvg, warsSvg] = svgs as [SVGSVGElement, SVGSVGElement, SVGSVGElement];
  expect(peopleSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Aristotle
  expect(warsSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Korean War
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1); // association football
  expect(container.querySelector('.d3-name')?.textContent).toBe('Aristotle');
});

test('the three lane sections and the year axis share the same rendered width', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );

  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(3); // People, Wars & Conflicts, Events & Inventions — YearAxis is plain HTML/CSS, no svg
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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

test('a mousedown on the reserved native scrollbar strip does not start a pan, so the browser can drag its own thumb', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, writable: true });
  Object.defineProperty(scrollContainer, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(scrollContainer, 'offsetHeight', { value: 615, configurable: true });

  // offsetY isn't a settable PointerEventInit field (it's computed from
  // layout), so it's overridden directly on the event instance rather than
  // passed through fireEvent's init dict. 610 falls inside the 15px
  // scrollbar strip below clientHeight.
  const pointerDown = new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  Object.defineProperty(pointerDown, 'offsetY', { value: 610 });
  fireEvent(scrollContainer, pointerDown);
  fireEvent.pointerMove(scrollContainer, { pointerType: 'mouse', clientX: 460, pointerId: 1 });
  expect(scrollContainer.scrollLeft).toBe(100); // untouched — no pan started
});

test('releasing a drag suppresses the click event that follows it', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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
      wars={[]}
      discoveries={[]}
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
      wars={[]}
      discoveries={[]}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={noopEntityClick}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  rerender(
    <TimelineCanvas
      people={[lowFamePerson]}
      wars={[]}
      discoveries={[]}
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
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
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={onEntityClick}
    />,
  );

  const scrollContainer = container.querySelector('[class*="scrollContainer"]') as HTMLElement;
  fireEvent.click(scrollContainer);

  expect(onEntityClick).not.toHaveBeenCalled();
});

test('a mark with an unrecognized data-entity-type is ignored rather than reported (fails closed, not silently as a discovery)', () => {
  const onEntityClick = vi.fn();
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
      onEntityClick={onEntityClick}
    />,
  );

  const line = container.querySelector('.d3-line') as SVGLineElement;
  line.setAttribute('data-entity-type', 'not-a-real-type');
  fireEvent.click(line);

  expect(onEntityClick).not.toHaveBeenCalled();
});
