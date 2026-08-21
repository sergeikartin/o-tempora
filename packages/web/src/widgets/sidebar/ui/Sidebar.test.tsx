import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CONFLICTS_MILESTONES_FILTER_VALUES } from '../../../shared/config';
import { OCCUPATION_DOMAINS, REGIONS } from '../../../shared/types';
import { Sidebar } from './Sidebar';

afterEach(cleanup);

const fameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  return render(
    <Sidebar
      fameScoreValues={fameScoreValues}
      onFameScoreChange={vi.fn()}
      onSelectDepthLevel={vi.fn()}
      selectedDomains={[]}
      onToggleDomain={vi.fn()}
      selectedRegions={[]}
      onToggleRegion={vi.fn()}
      selectedConflictsMilestonesValues={[]}
      onToggleConflictsMilestonesValue={vi.fn()}
      isOpen={false}
      onClose={vi.fn()}
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      onOpenAbout={vi.fn()}
      {...overrides}
    />,
  );
}

test('renders one Occupation Domain pill per OccupationDomain', () => {
  const { getByRole } = renderSidebar();

  const people = getByRole('heading', { name: 'People' }).closest('section');
  expect(people?.querySelectorAll('li')).toHaveLength(
    OCCUPATION_DOMAINS.length,
  );
  expect(people?.textContent).toContain('Science & Technology');
});

test('renders the fame-score filter inputs when the fameFilters flag is set, pre-filled with the given values', () => {
  window.history.pushState({}, '', '/?fameFilters=1');

  try {
    const { getByLabelText } = renderSidebar();

    expect(
      (getByLabelText('Minimum fame score for People') as HTMLInputElement)
        .value,
    ).toBe('90');
  } finally {
    window.history.pushState({}, '', '/');
  }
});

test('hides the fame-score filter inputs when the fameFilters flag is absent', () => {
  const { queryByLabelText } = renderSidebar();

  expect(queryByLabelText('Minimum fame score for People')).toBeNull();
});

test('renders the Data Depth switch, showing Mainstream active for the default values', () => {
  const { getByRole } = renderSidebar({
    fameScoreValues: { people: 88, conflicts: 82, milestones: 82 },
  });

  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-pressed'),
  ).toBe('true');
});

test('clicking an Occupation Domain pill calls onToggleDomain with that domain', () => {
  const onToggleDomain = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleDomain });

  fireEvent.click(getByLabelText('Filter by Arts'));

  expect(onToggleDomain).toHaveBeenCalledWith('arts');
});

test('renders one Region pill per Region', () => {
  const { getByRole } = renderSidebar();

  const region = getByRole('heading', { name: 'Region' }).closest('section');
  expect(region?.querySelectorAll('li')).toHaveLength(REGIONS.length);
  expect(region?.textContent).toContain('Western Asia');
});

test('clicking a Region pill calls onToggleRegion with that region', () => {
  const onToggleRegion = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleRegion });

  fireEvent.click(getByLabelText('Filter by Western Asia'));

  expect(onToggleRegion).toHaveBeenCalledWith('western-asia');
});

test('renders the Conflicts & Milestones section with one pill per filter value (Conflicts + 2 Milestone Category Groups), none pressed by default', () => {
  const { getByRole, getByLabelText } = renderSidebar();

  const section = getByRole('heading', {
    name: 'Conflicts & Milestones',
  }).closest('section');
  expect(section?.querySelectorAll('li')).toHaveLength(
    CONFLICTS_MILESTONES_FILTER_VALUES.length,
  );
  expect(section?.textContent).toContain('Science & Innovation');
  expect(
    getByLabelText('Filter by Conflicts').getAttribute('aria-pressed'),
  ).toBe('false');
});

test('clicking a Milestone Category Group pill calls onToggleConflictsMilestonesValue with that group', () => {
  const onToggleConflictsMilestonesValue = vi.fn();
  const { getByLabelText } = renderSidebar({
    onToggleConflictsMilestonesValue,
  });

  fireEvent.click(getByLabelText('Filter by Social & Human Culture'));

  expect(onToggleConflictsMilestonesValue).toHaveBeenCalledWith(
    'social-culture',
  );
});

test("clicking the Conflicts pill calls onToggleConflictsMilestonesValue with 'conflicts'", () => {
  const onToggleConflictsMilestonesValue = vi.fn();
  const { getByLabelText } = renderSidebar({
    onToggleConflictsMilestonesValue,
  });

  fireEvent.click(getByLabelText('Filter by Conflicts'));

  expect(onToggleConflictsMilestonesValue).toHaveBeenCalledWith('conflicts');
});

test('closed (isOpen: false) renders no backdrop and no open class on the sidebar', () => {
  const { container, queryByLabelText } = renderSidebar({ isOpen: false });

  expect(queryByLabelText('Close')).toBeNull();
  expect(container.querySelector('[class*="open"]')).toBeNull();
});

test('open (isOpen: true) renders a backdrop and an open class on the sidebar', () => {
  const { container, getByLabelText } = renderSidebar({ isOpen: true });

  expect(getByLabelText('Close')).toBeTruthy();
  expect(container.querySelector('aside[class*="open"]')).toBeTruthy();
});

test('clicking the backdrop calls onClose', () => {
  const onClose = vi.fn();
  const { getByLabelText } = renderSidebar({ isOpen: true, onClose });

  fireEvent.click(getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('below the mobile breakpoint, a closed drawer is inert (off-screen filter controls are not keyboard/screen-reader reachable); an open one is not', () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  try {
    const { container, rerender } = renderSidebar({ isOpen: false });
    expect(container.querySelector('aside')?.hasAttribute('inert')).toBe(true);

    rerender(
      <Sidebar
        fameScoreValues={fameScoreValues}
        onFameScoreChange={vi.fn()}
        onSelectDepthLevel={vi.fn()}
        selectedDomains={[]}
        onToggleDomain={vi.fn()}
        selectedRegions={[]}
        onToggleRegion={vi.fn()}
        selectedConflictsMilestonesValues={[]}
        onToggleConflictsMilestonesValue={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        onOpenAbout={vi.fn()}
      />,
    );
    expect(container.querySelector('aside')?.hasAttribute('inert')).toBe(false);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

test('above the mobile breakpoint, the sidebar is never inert, even while isOpen is false (its default, desktop-only state)', () => {
  const { container } = renderSidebar({ isOpen: false });
  expect(container.querySelector('aside')?.hasAttribute('inert')).toBe(false);
});

test('below the mobile breakpoint, an explicit close button renders inside the drawer and calls onClose when clicked', () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  try {
    const onClose = vi.fn();
    const { getByLabelText, getByRole } = renderSidebar({
      isOpen: true,
      onClose,
    });

    expect(getByRole('heading', { name: 'Filters' })).toBeTruthy();
    fireEvent.click(getByLabelText('Close filters'));

    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

test('above the mobile breakpoint, the same "Filters" title renders as mobile\'s, but with no drawer close button — desktop has no drawer to close', () => {
  const { queryByLabelText, queryByRole } = renderSidebar({ isOpen: true });
  expect(queryByLabelText('Close filters')).toBeNull();
  expect(queryByRole('heading', { name: 'Filters' })).toBeTruthy();
});

test('collapsed (isCollapsed: true) renders no filter sections and no title, but keeps the collapse button itself reachable', () => {
  const { container, queryByRole, getByLabelText } = renderSidebar({
    isCollapsed: true,
  });

  expect(queryByRole('heading', { name: 'Region' })).toBeNull();
  expect(queryByRole('heading', { name: 'Filters' })).toBeNull();
  expect(container.querySelector('aside')?.hasAttribute('inert')).toBe(false);
  expect(getByLabelText('Expand filters')).toBeTruthy();
});

test('clicking the collapse handle calls onToggleCollapse', () => {
  const onToggleCollapse = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleCollapse });

  fireEvent.click(getByLabelText('Collapse filters'));

  expect(onToggleCollapse).toHaveBeenCalledTimes(1);
});

test('below the mobile breakpoint, isCollapsed has no effect — filter sections still render', () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  try {
    const { queryByRole } = renderSidebar({ isCollapsed: true, isOpen: true });
    expect(queryByRole('heading', { name: 'Region' })).toBeTruthy();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});
