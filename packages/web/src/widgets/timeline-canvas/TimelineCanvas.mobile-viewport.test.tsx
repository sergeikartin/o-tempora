import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
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
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const defaultFameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

test('below the mobile breakpoint, a drawer-toggle button renders and calls onToggleFilterDrawer when clicked', () => {
  mobileMatches = true;
  mockMatchMedia();
  const onToggleFilterDrawer = vi.fn();
  const { getByLabelText } = render(
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
      onToggleFilterDrawer={onToggleFilterDrawer}
    />,
  );

  const toggle = getByLabelText('Filters');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');

  fireEvent.click(toggle);

  expect(onToggleFilterDrawer).toHaveBeenCalledTimes(1);
});

test('above the mobile breakpoint, no drawer-toggle button renders', () => {
  mobileMatches = false;
  mockMatchMedia();
  const { queryByLabelText } = render(
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

  expect(queryByLabelText('Filters')).toBeNull();
});

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
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(queryByTestId('minimap-track')).toBeNull();
});

test('above the mobile breakpoint, Minimap renders', () => {
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
      isFilterDrawerOpen={false}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(queryByTestId('minimap-track')).not.toBeNull();
});

test('the drawer-toggle button reflects isFilterDrawerOpen via aria-expanded', () => {
  mobileMatches = true;
  mockMatchMedia();
  const { getByLabelText } = render(
    <TimelineCanvas
      people={[aristotle]}
      conflicts={[]}
      milestones={[]}
      fameScoreValues={defaultFameScoreValues}
      selectedDomains={[]}
      selectedRegions={[]}
      selectedConflictsMilestonesValues={[]}
      onEntityClick={() => {}}
      isFilterDrawerOpen={true}
      onToggleFilterDrawer={() => {}}
    />,
  );

  expect(getByLabelText('Filters').getAttribute('aria-expanded')).toBe('true');
});
