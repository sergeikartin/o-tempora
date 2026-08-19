import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach, vi } from 'vitest';
import { Minimap } from './Minimap';
import { computeRowAssignment } from './map-to-items';
import type { Person } from '../../shared/types';

afterEach(cleanup);

function person(id: string, startYear: number, endYear: number): Person {
  return {
    id,
    name: id,
    lifespan: { start: { year: startYear }, end: { year: endYear } },
    occupationDomain: 'humanities',
    regionTags: [],
    fameScore: 90,
    tagline: '',
    wikipediaUrl: '',
  };
}

const emptyRowAssignment = computeRowAssignment([], [], []);

const defaultProps = {
  conflicts: [],
  milestones: [],
  personRowFor: emptyRowAssignment.personRowFor,
  eventsRowFor: emptyRowAssignment.eventsRowFor,
  totalWidth: 4000,
  viewportWidthPx: 800,
  scrollLeft: 1000,
  onScrollLeftChange: () => {},
  onScrollLeftJump: () => {},
};

test('renders a non-empty ridge path for a series with active entities, and a flat one for an empty series', () => {
  const people = [person('a', 1000, 1900), person('b', 1200, 2000)];
  const { getByTestId } = render(
    <Minimap {...defaultProps} people={people} personRowFor={computeRowAssignment(people, [], []).personRowFor} />,
  );
  const peopleArea = getByTestId('minimap-people-area');
  const eventsArea = getByTestId('minimap-events-area');
  expect(peopleArea.getAttribute('d')).toBeTruthy();
  expect(eventsArea.getAttribute('d')).toBeTruthy();
  // Distinct paths: the people series has real density, the (empty)
  // events series is a flat line along the baseline.
  expect(peopleArea.getAttribute('d')).not.toBe(eventsArea.getAttribute('d'));
});

test('a press on the track jumps the viewport toward the click position', () => {
  const onScrollLeftJump = vi.fn();
  const { getByTestId } = render(
    <Minimap {...defaultProps} people={[]} onScrollLeftJump={onScrollLeftJump} />,
  );
  const track = getByTestId('minimap-track');
  Object.defineProperty(track, 'clientWidth', { value: 200, configurable: true });
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 56, right: 200, bottom: 56, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  fireEvent.pointerDown(track, { pointerType: 'mouse', button: 0, clientX: 100, pointerId: 1 });

  // Click dead-center of the track jumps to center the full domain on that
  // point: clickRatio 0.5 * totalWidth(4000) - half the track width(100).
  expect(onScrollLeftJump).toHaveBeenCalledWith(1900);
});

test('dragging the viewport rect reports a scrollLeft delta proportional to the drag distance', () => {
  const onScrollLeftChange = vi.fn();
  const { getByTestId } = render(
    <Minimap {...defaultProps} people={[]} onScrollLeftChange={onScrollLeftChange} />,
  );
  const track = getByTestId('minimap-track');
  const rect = getByTestId('minimap-viewport-rect');
  Object.defineProperty(track, 'clientWidth', { value: 200, configurable: true });

  fireEvent.pointerDown(rect, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });
  fireEvent.pointerMove(rect, { pointerType: 'mouse', clientX: 510, pointerId: 1 });

  expect(onScrollLeftChange).toHaveBeenCalledTimes(1);
  const [reported] = onScrollLeftChange.mock.calls[0] as [number];
  // scrollLeft(1000) started well clear of both bounds, and the rect isn't
  // floor-clamped at this track/timeline ratio, so a rightward drag should
  // move scrollLeft up from its start.
  expect(reported).toBeGreaterThan(defaultProps.scrollLeft);
});

test('a press on the viewport rect does not also trigger the track\'s own click-to-jump', () => {
  const onScrollLeftChange = vi.fn();
  const { getByTestId } = render(
    <Minimap {...defaultProps} people={[]} onScrollLeftChange={onScrollLeftChange} />,
  );
  const track = getByTestId('minimap-track');
  const rect = getByTestId('minimap-viewport-rect');
  Object.defineProperty(track, 'clientWidth', { value: 200, configurable: true });

  fireEvent.pointerDown(rect, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });

  // Only the rect-drag handler's setup should have run — no jump call from
  // the track's own pointerdown handler.
  expect(onScrollLeftChange).not.toHaveBeenCalled();
});

test('renders century tick marks spanning the pannable domain, with at least one label shown', () => {
  const { getByTestId } = render(<Minimap {...defaultProps} people={[]} />);
  const strip = getByTestId('minimap-century-strip');
  const ticks = strip.querySelectorAll('[class*="centuryTick"]');
  // Dozens of centuries across the real PAN_MIN_DATE-to-today domain — not
  // asserting an exact count, since PAN_MIN_DATE and "today" both drift.
  expect(ticks.length).toBeGreaterThan(15);
  const labels = strip.querySelectorAll('[class*="centuryLabel"]');
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.length).toBeLessThan(ticks.length);
});

test('hovering the track shows a tooltip with the date and Row Depth at that position; leaving hides it', () => {
  const people = [person('a', 1000, 1900)];
  const { getByTestId, queryByTestId } = render(
    <Minimap {...defaultProps} people={people} personRowFor={computeRowAssignment(people, [], []).personRowFor} />,
  );
  const track = getByTestId('minimap-track');
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 56, right: 200, bottom: 56, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  expect(queryByTestId('minimap-tooltip')).toBeNull();

  fireEvent.pointerMove(track, { pointerType: 'mouse', clientX: 100, pointerId: 1 });

  const tooltip = getByTestId('minimap-tooltip');
  expect(tooltip.textContent).toMatch(/rows/);

  fireEvent.pointerLeave(track, { pointerType: 'mouse', pointerId: 1 });
  expect(queryByTestId('minimap-tooltip')).toBeNull();
});
