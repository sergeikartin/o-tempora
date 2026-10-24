import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CONFLICTS_MILESTONES_FILTER_VALUES } from '../../../shared/config';
import { OCCUPATION_DOMAINS, REGIONS } from '../../../shared/types';
import { TopBar } from './TopBar';

afterEach(cleanup);

type TopBarProps = Parameters<typeof TopBar>[0];

function renderTopBar(overrides: Partial<TopBarProps> = {}) {
  return render(
    <TopBar
      selectedLevelId="mainstream"
      onSelectDetailLevel={vi.fn()}
      loadingLevelIds={[]}
      searchQuery=""
      onSearchQueryChange={vi.fn()}
      searchResults={[]}
      onSelectSearchResult={vi.fn()}
      selectedDomains={[]}
      onToggleDomain={vi.fn()}
      selectedRegions={[]}
      onToggleRegion={vi.fn()}
      selectedConflictsMilestonesValues={[]}
      onToggleConflictsMilestonesValue={vi.fn()}
      onOpenHelp={vi.fn()}
      {...overrides}
    />,
  );
}

function openFilters(view: ReturnType<typeof renderTopBar>) {
  fireEvent.click(view.getByRole('button', { name: /^Filters/ }));
  return view.getByRole('dialog', { name: 'Filters' });
}

test('Search, Detail Level, Filters and Help are all reachable with nothing open', () => {
  const { getByRole } = renderTopBar({ selectedLevelId: 'deep-cut' });

  expect(getByRole('combobox', { name: 'Search timeline' })).toBeTruthy();
  expect(
    getByRole('button', { name: 'Deep Cut' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-pressed'),
  ).toBe('false');
  expect(getByRole('button', { name: 'Filters' })).toBeTruthy();
  expect(getByRole('button', { name: 'Help' })).toBeTruthy();
});

test('the Help button calls onOpenHelp', () => {
  const onOpenHelp = vi.fn();
  const { getByRole } = renderTopBar({ onOpenHelp });

  fireEvent.click(getByRole('button', { name: 'Help' }));

  expect(onOpenHelp).toHaveBeenCalledTimes(1);
});

test('the filter groups stay out of the bar until the Filters button is pressed', () => {
  const view = renderTopBar();

  expect(view.queryByRole('dialog')).toBeNull();
  expect(view.queryByLabelText('Filter by Arts')).toBeNull();
  const button = view.getByRole('button', { name: 'Filters' });
  expect(button.getAttribute('aria-expanded')).toBe('false');

  openFilters(view);

  expect(button.getAttribute('aria-expanded')).toBe('true');
});

test('the Filters button shows the number of active filters across all three groups', () => {
  const none = renderTopBar();
  expect(none.container.textContent).not.toMatch(/Filters\d/);
  cleanup();

  const { getByRole } = renderTopBar({
    selectedDomains: ['arts', 'sports'],
    selectedRegions: ['western-asia'],
    selectedConflictsMilestonesValues: ['conflicts'],
  });

  const button = getByRole('button', { name: 'Filters, 4 active' });
  expect(button.textContent).toBe('Filters4');
});

test('the panel renders one Occupation Domain pill per OccupationDomain', () => {
  const view = renderTopBar();
  const panel = openFilters(view);

  const section = view
    .getByRole('heading', { name: 'Occupation' })
    .closest('section');
  expect(section?.querySelectorAll('li')).toHaveLength(
    OCCUPATION_DOMAINS.length,
  );
  expect(section?.textContent).toContain('Science & Technology');
  expect(panel.contains(section)).toBe(true);
});

test('the panel renders one Region pill per Region', () => {
  const view = renderTopBar();
  openFilters(view);

  const section = view
    .getByRole('heading', { name: 'Region' })
    .closest('section');
  expect(section?.querySelectorAll('li')).toHaveLength(REGIONS.length);
  expect(section?.textContent).toContain('Western Asia');
});

test('the panel renders Conflicts & Milestones with one pill per filter value, none pressed by default', () => {
  const view = renderTopBar();
  openFilters(view);

  const section = view
    .getByRole('heading', { name: 'Conflicts & Milestones' })
    .closest('section');
  expect(section?.querySelectorAll('li')).toHaveLength(
    CONFLICTS_MILESTONES_FILTER_VALUES.length,
  );
  expect(
    view.getByLabelText('Filter by Conflicts').getAttribute('aria-pressed'),
  ).toBe('false');
});

test('pills in the panel call their toggle handlers', () => {
  const onToggleDomain = vi.fn();
  const onToggleRegion = vi.fn();
  const onToggleConflictsMilestonesValue = vi.fn();
  const view = renderTopBar({
    onToggleDomain,
    onToggleRegion,
    onToggleConflictsMilestonesValue,
  });
  openFilters(view);

  fireEvent.click(view.getByLabelText('Filter by Arts'));
  fireEvent.click(view.getByLabelText('Filter by Western Asia'));
  fireEvent.click(view.getByLabelText('Filter by Society & Culture'));
  fireEvent.click(view.getByLabelText('Filter by Conflicts'));

  expect(onToggleDomain).toHaveBeenCalledWith('arts');
  expect(onToggleRegion).toHaveBeenCalledWith('western-asia');
  expect(onToggleConflictsMilestonesValue).toHaveBeenNthCalledWith(
    1,
    'social-culture',
  );
  expect(onToggleConflictsMilestonesValue).toHaveBeenNthCalledWith(
    2,
    'conflicts',
  );
});

test('opening the panel moves focus inside and Escape closes it', () => {
  const view = renderTopBar();
  const panel = openFilters(view);

  expect(panel.contains(document.activeElement)).toBe(true);

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(view.queryByRole('dialog')).toBeNull();
});

test('Tab wraps inside the open panel instead of leaving it', () => {
  const view = renderTopBar();
  const panel = openFilters(view);
  const focusable = panel.querySelectorAll<HTMLElement>('button');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  last?.focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(first);

  first?.focus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
});

test('the close button and the backdrop each close the panel', () => {
  const view = renderTopBar();

  openFilters(view);
  fireEvent.click(view.getByLabelText('Close filters'));
  expect(view.queryByRole('dialog')).toBeNull();

  openFilters(view);
  fireEvent.click(view.getByLabelText('Close'));
  expect(view.queryByRole('dialog')).toBeNull();
});
