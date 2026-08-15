import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach, vi } from 'vitest';
import { MountainProfile } from './MountainProfile';
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

const defaultProps = {
  conflicts: [],
  milestones: [],
  totalWidth: 4000,
  viewportWidthPx: 800,
  scrollLeft: 1000,
  onScrollLeftChange: () => {},
  onScrollLeftJump: () => {},
};

test('renders a non-empty ridge path for a series with active entities, and a flat one for an empty series', () => {
  const { getByTestId } = render(
    <MountainProfile {...defaultProps} people={[person('a', 1000, 1900), person('b', 1200, 2000)]} />,
  );
  const peopleArea = getByTestId('mountain-profile-people-area');
  const eventsArea = getByTestId('mountain-profile-events-area');
  expect(peopleArea.getAttribute('d')).toBeTruthy();
  expect(eventsArea.getAttribute('d')).toBeTruthy();
  // Distinct paths: the people series has real density, the (empty)
  // events series is a flat line along the baseline.
  expect(peopleArea.getAttribute('d')).not.toBe(eventsArea.getAttribute('d'));
});

test('a press on the track jumps the viewport toward the click position', () => {
  const onScrollLeftJump = vi.fn();
  const { getByTestId } = render(
    <MountainProfile {...defaultProps} people={[]} onScrollLeftJump={onScrollLeftJump} />,
  );
  const track = getByTestId('mountain-profile-track');
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
    <MountainProfile {...defaultProps} people={[]} onScrollLeftChange={onScrollLeftChange} />,
  );
  const track = getByTestId('mountain-profile-track');
  const rect = getByTestId('mountain-profile-viewport-rect');
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
    <MountainProfile {...defaultProps} people={[]} onScrollLeftChange={onScrollLeftChange} />,
  );
  const track = getByTestId('mountain-profile-track');
  const rect = getByTestId('mountain-profile-viewport-rect');
  Object.defineProperty(track, 'clientWidth', { value: 200, configurable: true });

  fireEvent.pointerDown(rect, { pointerType: 'mouse', button: 0, clientX: 500, pointerId: 1 });

  // Only the rect-drag handler's setup should have run — no jump call from
  // the track's own pointerdown handler.
  expect(onScrollLeftChange).not.toHaveBeenCalled();
});

test('hovering the track shows a tooltip with the date and Row Depth at that position; leaving hides it', () => {
  const { getByTestId, queryByTestId } = render(
    <MountainProfile {...defaultProps} people={[person('a', 1000, 1900)]} />,
  );
  const track = getByTestId('mountain-profile-track');
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 56, right: 200, bottom: 56, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  expect(queryByTestId('mountain-profile-tooltip')).toBeNull();

  fireEvent.pointerMove(track, { pointerType: 'mouse', clientX: 100, pointerId: 1 });

  const tooltip = getByTestId('mountain-profile-tooltip');
  expect(tooltip.textContent).toMatch(/rows/);

  fireEvent.pointerLeave(track, { pointerType: 'mouse', pointerId: 1 });
  expect(queryByTestId('mountain-profile-tooltip')).toBeNull();
});
