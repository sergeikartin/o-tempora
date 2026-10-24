import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Person } from '../../shared/types';
import {
  buildXScale,
  clampPixelsPerYear,
  MIN_YEAR,
  REFERENCE_PIXELS_PER_YEAR,
  wheelZoomFactor,
} from './options';
import { TimelineCanvas } from './TimelineCanvas';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const aristotle: Person = {
  id: 'Q868',
  slug: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const VIEWPORT_WIDTH_PX = 1000;

function renderCanvas(startScrollLeft = 2000) {
  const result = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={{ people: 90, conflicts: 100, milestones: 200 }}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
    />,
  );
  const scrollContainer = result.container.querySelector(
    '[class*="scrollContainer"]',
  ) as HTMLElement;
  Object.defineProperty(scrollContainer, 'clientWidth', {
    value: VIEWPORT_WIDTH_PX,
    configurable: true,
  });
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: startScrollLeft,
    writable: true,
  });
  return { ...result, scrollContainer };
}

function personLineWidth(container: HTMLElement): number {
  const [peopleSvg] = Array.from(container.querySelectorAll('svg')) as [
    SVGSVGElement,
  ];
  const line = peopleSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

test('ctrl+wheel zooms in once the wheel settles, keeping the year under the cursor fixed', async () => {
  const { container, scrollContainer } = renderCanvas();
  const initialWidth = personLineWidth(container);
  const cursorX = 300;
  const anchorYear = buildXScale(REFERENCE_PIXELS_PER_YEAR).scale.invert(
    scrollContainer.scrollLeft + cursorX,
  );

  fireEvent.wheel(scrollContainer, {
    ctrlKey: true,
    deltaY: -20,
    clientX: cursorX,
  });
  fireEvent.wheel(scrollContainer, {
    ctrlKey: true,
    deltaY: -20,
    clientX: cursorX,
  });
  // Mid-gesture the marks are not re-rendered.
  expect(personLineWidth(container)).toBe(initialWidth);
  await wait(300);

  const expectedPixelsPerYear = clampPixelsPerYear(
    REFERENCE_PIXELS_PER_YEAR * wheelZoomFactor(-20) ** 2,
    VIEWPORT_WIDTH_PX,
  );
  expect(personLineWidth(container)).toBeCloseTo(
    initialWidth * (expectedPixelsPerYear / REFERENCE_PIXELS_PER_YEAR),
  );
  const yearUnderCursor = buildXScale(expectedPixelsPerYear).scale.invert(
    scrollContainer.scrollLeft + cursorX,
  );
  expect(yearUnderCursor).toBeCloseTo(anchorYear, 3);
  expect(MIN_YEAR).toBeLessThan(anchorYear);
});

test('ctrl+wheel prevents the browser page zoom; a plain wheel does not', () => {
  const { scrollContainer } = renderCanvas();
  const zoomEvent = new WheelEvent('wheel', {
    ctrlKey: true,
    deltaY: -5,
    cancelable: true,
    bubbles: true,
  });
  scrollContainer.dispatchEvent(zoomEvent);
  const plainEvent = new WheelEvent('wheel', {
    deltaY: 50,
    cancelable: true,
    bubbles: true,
  });
  scrollContainer.dispatchEvent(plainEvent);
  expect(zoomEvent.defaultPrevented).toBe(true);
  expect(plainEvent.defaultPrevented).toBe(false);
});

test('shift+wheel pans, clamped to the start of the timeline', () => {
  const { scrollContainer } = renderCanvas(100);
  fireEvent.wheel(scrollContainer, { shiftKey: true, deltaY: 60 });
  expect(scrollContainer.scrollLeft).toBe(160);
  fireEvent.wheel(scrollContainer, { shiftKey: true, deltaY: -500 });
  expect(scrollContainer.scrollLeft).toBe(0);
});

test('a wheel zoom already at the zoom limit changes nothing', async () => {
  const { container, scrollContainer } = renderCanvas();
  for (let i = 0; i < 12; i += 1) {
    fireEvent.wheel(scrollContainer, { ctrlKey: true, deltaY: 20 });
  }
  await wait(300);
  const zoomedOutWidth = personLineWidth(container);
  fireEvent.wheel(scrollContainer, { ctrlKey: true, deltaY: 20 });
  await wait(300);
  expect(personLineWidth(container)).toBe(zoomedOutWidth);
});

test('arrow keys pan a tenth of the viewport, half with Shift', () => {
  const { scrollContainer } = renderCanvas(2000);
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(scrollContainer.scrollLeft).toBe(2100);
  fireEvent.keyDown(document.body, { key: 'ArrowLeft', shiftKey: true });
  expect(scrollContainer.scrollLeft).toBe(1600);
});

test('+ and = zoom in and - zooms out', async () => {
  const { container } = renderCanvas();
  const initialWidth = personLineWidth(container);
  fireEvent.keyDown(document.body, { key: '+' });
  await wait(100);
  const zoomedIn = personLineWidth(container);
  expect(zoomedIn).toBeGreaterThan(initialWidth);
  fireEvent.keyDown(document.body, { key: '=' });
  await wait(100);
  expect(personLineWidth(container)).toBeGreaterThan(zoomedIn);
  fireEvent.keyDown(document.body, { key: '-' });
  await wait(100);
  fireEvent.keyDown(document.body, { key: '-' });
  await wait(100);
  expect(personLineWidth(container)).toBeLessThan(zoomedIn);
});

test('the keys are ignored in a text field, in a radio group fieldset and under an open modal', async () => {
  const { container, scrollContainer } = renderCanvas(2000);
  const initialWidth = personLineWidth(container);
  const input = document.body.appendChild(document.createElement('input'));
  const fieldset = document.body.appendChild(
    document.createElement('fieldset'),
  );
  const radioButton = fieldset.appendChild(document.createElement('button'));

  fireEvent.keyDown(input, { key: 'ArrowRight' });
  fireEvent.keyDown(input, { key: '-' });
  fireEvent.keyDown(radioButton, { key: 'ArrowRight' });
  fireEvent.keyDown(radioButton, { key: '+' });

  const modal = document.body.appendChild(document.createElement('div'));
  modal.setAttribute('aria-modal', 'true');
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  fireEvent.keyDown(document.body, { key: '+' });
  await wait(100);

  expect(scrollContainer.scrollLeft).toBe(2000);
  expect(personLineWidth(container)).toBe(initialWidth);
});

test('keys with Ctrl, Cmd or Alt held are left to the browser', () => {
  const { scrollContainer } = renderCanvas(2000);
  fireEvent.keyDown(document.body, { key: 'ArrowRight', ctrlKey: true });
  fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
  fireEvent.keyDown(document.body, { key: '=', ctrlKey: true });
  expect(scrollContainer.scrollLeft).toBe(2000);
});

test('the lane regions are keyboard-focusable', () => {
  const { getByRole } = renderCanvas();
  expect(getByRole('region', { name: 'People' }).tabIndex).toBe(0);
});

test('a released mouse drag coasts on, and stops exactly at the end of the timeline', async () => {
  const maxScrollLeft =
    buildXScale(REFERENCE_PIXELS_PER_YEAR).totalWidth - VIEWPORT_WIDTH_PX;
  const { scrollContainer } = renderCanvas(maxScrollLeft - 150);

  fireEvent.pointerDown(scrollContainer, {
    pointerType: 'mouse',
    button: 0,
    clientX: 500,
    pointerId: 1,
  });
  await wait(10);
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 480,
    pointerId: 1,
  });
  await wait(10);
  fireEvent.pointerMove(scrollContainer, {
    pointerType: 'mouse',
    clientX: 440,
    pointerId: 1,
  });
  fireEvent.pointerUp(scrollContainer, { pointerType: 'mouse', pointerId: 1 });
  const atRelease = scrollContainer.scrollLeft;

  await wait(1500);
  expect(scrollContainer.scrollLeft).toBeGreaterThan(atRelease);
  expect(scrollContainer.scrollLeft).toBeLessThanOrEqual(maxScrollLeft);
  expect(scrollContainer.scrollLeft).toBe(maxScrollLeft);
});
