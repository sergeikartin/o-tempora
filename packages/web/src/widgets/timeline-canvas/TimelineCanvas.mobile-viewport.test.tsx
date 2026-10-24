import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Person } from '../../shared/types';
import { TimelineCanvas } from './TimelineCanvas';

afterEach(cleanup);

// A separate file (not tests inside TimelineCanvas.test.tsx) so mocking
// window.matchMedia here — needed to force useIsMobileViewport() true —
// can't leak into that file's many tests, which all rely on the default
// (unmocked, desktop) path. Mirrors TimelineCanvas.reduced-motion.test.tsx's
// same isolation rationale for its own matchMedia mock.
let mobileMatches = false;

function mockMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('max-width') ? mobileMatches : false;
    },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

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

const defaultFameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

test('below the mobile breakpoint, Minimap does not render', () => {
  mobileMatches = true;
  mockMatchMedia();
  const { queryByTestId } = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
    />,
  );

  expect(queryByTestId('minimap-track')).toBeNull();
  expect(queryByTestId('scrubber-track')).not.toBeNull();
});

test('above the mobile breakpoint, Minimap renders', async () => {
  mobileMatches = false;
  mockMatchMedia();
  const { findByTestId } = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
    />,
  );

  // Minimap's own mount is deferred to idle time (TimelineCanvas.tsx's
  // isMinimapIdle) — findByTestId waits it out instead of assuming it's
  // there synchronously after render.
  expect(await findByTestId('minimap-track')).not.toBeNull();
});

test('above the mobile breakpoint, the Scrubber does not render', () => {
  mobileMatches = false;
  mockMatchMedia();
  const { queryByTestId } = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
    />,
  );

  expect(queryByTestId('scrubber-track')).toBeNull();
});
