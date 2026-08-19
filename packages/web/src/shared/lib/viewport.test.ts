import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { MOBILE_BREAKPOINT_PX, useIsMobileViewport } from './viewport';

afterEach(cleanup);

let changeListener: (() => void) | null = null;
let currentMatches = false;

// Same stub shape as TimelineCanvas.reduced-motion.test.tsx's matchMedia
// mock, plus a capturable listener so a dispatched 'change' can be
// simulated without a real browser resize.
beforeEach(() => {
  changeListener = null;
  currentMatches = false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return currentMatches;
    },
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: () => void) => {
      changeListener = listener;
    },
    removeEventListener: () => {
      changeListener = null;
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

test(`useIsMobileViewport queries max-width: ${MOBILE_BREAKPOINT_PX}px`, () => {
  currentMatches = true;
  const { result } = renderHook(() => useIsMobileViewport());
  expect(result.current).toBe(true);
});

test('useIsMobileViewport reflects false when the query does not match', () => {
  currentMatches = false;
  const { result } = renderHook(() => useIsMobileViewport());
  expect(result.current).toBe(false);
});

test('useIsMobileViewport updates when the media query change event fires', () => {
  currentMatches = false;
  const { result } = renderHook(() => useIsMobileViewport());
  expect(result.current).toBe(false);

  currentMatches = true;
  act(() => {
    changeListener?.();
  });

  expect(result.current).toBe(true);
});
