import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { buildXScale, REFERENCE_PIXELS_PER_YEAR } from './options';
import { Scrubber, type ScrubberHandle } from './Scrubber';

afterEach(cleanup);

const TRACK_WIDTH_PX = 200;
const [domainMinYear = 0, domainMaxYear = 0] = buildXScale(
  REFERENCE_PIXELS_PER_YEAR,
).scale.domain();
const domainYears = domainMaxYear - domainMinYear;

function renderScrubber(
  props: Partial<React.ComponentProps<typeof Scrubber>> = {},
) {
  const utils = render(
    <Scrubber
      viewportStartYear={1740}
      viewportEndYear={1860}
      onCenterYearChange={() => {}}
      onCenterYearJump={() => {}}
      {...props}
    />,
  );
  const track = utils.getByTestId('scrubber-track');
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: TRACK_WIDTH_PX,
      height: 24,
      right: TRACK_WIDTH_PX,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return { ...utils, track, thumb: utils.getByTestId('scrubber-thumb') };
}

test('a tap on the track jumps to the year under the pointer', () => {
  const onCenterYearJump = vi.fn();
  const { track } = renderScrubber({ onCenterYearJump });

  fireEvent.pointerDown(track, {
    pointerType: 'touch',
    clientX: TRACK_WIDTH_PX / 2,
    pointerId: 1,
  });

  expect(onCenterYearJump).toHaveBeenCalledWith(
    domainMinYear + domainYears / 2,
  );
});

test('dragging the thumb reports the centre year, keeping the grab offset', () => {
  const onCenterYearChange = vi.fn();
  const onCenterYearJump = vi.fn();
  const { thumb } = renderScrubber({ onCenterYearChange, onCenterYearJump });
  const yearsPerPx = domainYears / TRACK_WIDTH_PX;
  const grabX = 100;

  fireEvent.pointerDown(thumb, {
    pointerType: 'touch',
    clientX: grabX,
    pointerId: 1,
  });
  fireEvent.pointerMove(thumb, {
    pointerType: 'touch',
    clientX: grabX + 10,
    pointerId: 1,
  });

  expect(onCenterYearJump).not.toHaveBeenCalled();
  expect(onCenterYearChange).toHaveBeenCalledTimes(1);
  expect(onCenterYearChange.mock.calls[0]?.[0]).toBeCloseTo(
    1800 + 10 * yearsPerPx,
    6,
  );
});

test('moves after the drag ends are ignored', () => {
  const onCenterYearChange = vi.fn();
  const { thumb } = renderScrubber({ onCenterYearChange });

  fireEvent.pointerDown(thumb, { pointerType: 'touch', clientX: 100 });
  fireEvent.pointerUp(thumb, { pointerType: 'touch', clientX: 100 });
  fireEvent.pointerMove(thumb, { pointerType: 'touch', clientX: 120 });

  expect(onCenterYearChange).not.toHaveBeenCalled();
});

test('setViewport moves the thumb without a re-render', () => {
  const ref = createRef<ScrubberHandle>();
  const { thumb } = renderScrubber({ ref });
  const before = thumb.style.left;

  ref.current?.setViewport(1000, 1100);

  expect(thumb.style.left).not.toBe(before);
});

test('the thumb never shrinks below its visible floor', () => {
  const { thumb } = renderScrubber({
    viewportStartYear: 1800,
    viewportEndYear: 1801,
  });

  expect(thumb.style.width).toContain('16px');
});
