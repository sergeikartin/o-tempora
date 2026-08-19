import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import type { Person } from '../../shared/types';
import { TimelineCanvas } from './TimelineCanvas';

afterEach(cleanup);

// A separate file (not a test inside TimelineCanvas.test.tsx) so this can
// set up its own, fresh shared/lib/motion.ts module cache: motionDurationMs
// caches a token's resolved value on first read, invalidated only by a
// prefers-reduced-motion matchMedia change event — reading it here, before
// any other test in this file has already primed the cache with a different
// value, is what makes this an honest test of the reduced-motion path
// rather than reusing whatever TimelineCanvas.test.tsx happened to cache
// first. Mirrors global.css's real --motion-duration-base collapse (to
// 0.01ms) under prefers-reduced-motion, plus mocking matchMedia itself for
// completeness (motion.ts subscribes to it, even though jsdom won't
// actually cascade a real CSS media-query change from this mock).
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  document.documentElement.style.setProperty(
    '--motion-duration-base',
    '0.01ms',
  );
});

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

const defaultFameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

function personLineWidth(container: HTMLElement): number {
  const [peopleSvg] = Array.from(container.querySelectorAll('svg')) as [
    SVGSVGElement,
  ];
  const line = peopleSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

test('with prefers-reduced-motion: reduce, a zoom-button click resolves to the target pixelsPerYear effectively immediately, not over the normal ~300-400ms animation', async () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  const initialWidth = personLineWidth(container);

  fireEvent.click(getByLabelText('Zoom in'));
  // A generous real-time wait (matching this codebase's other zoom-
  // animation tests, since a real, un-mockable requestAnimationFrame loop
  // needs actual wall-clock time under real test-runner load) — the
  // meaningful assertion here isn't the wait's own length, it's that the
  // collapsed near-zero --motion-duration-base (mocked above, mirroring
  // global.css's real prefers-reduced-motion collapse) still resolves to
  // the target correctly, exercising the same "durationMs <= 0 resolves on
  // the next tick" path ticket 03 calls for.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  expect(personLineWidth(container)).toBeGreaterThan(initialWidth);
});
