import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { Sidebar } from './Sidebar';
import { OCCUPATION_DOMAINS, REGIONS } from '../../../shared/types';
import { CONFLICTS_MILESTONES_FILTER_VALUES } from '../../../shared/config';

afterEach(cleanup);

const fameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

type SidebarProps = Parameters<typeof Sidebar>[0];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  return render(
    <Sidebar
      fameScoreValues={fameScoreValues}
      onFameScoreChange={vi.fn()}
      selectedDomains={[]}
      onToggleDomain={vi.fn()}
      selectedRegions={[]}
      onToggleRegion={vi.fn()}
      selectedConflictsMilestonesValues={[]}
      onToggleConflictsMilestonesValue={vi.fn()}
      {...overrides}
    />,
  );
}

test('renders one Occupation Domain pill per OccupationDomain', () => {
  const { getByRole } = renderSidebar();

  const people = getByRole('heading', { name: 'People' }).closest('section');
  expect(people?.querySelectorAll('li')).toHaveLength(OCCUPATION_DOMAINS.length);
  expect(people?.textContent).toContain('Science & Technology');
});

test('renders the fame-score filter inputs, pre-filled with the given values', () => {
  const { getByLabelText } = renderSidebar();

  expect((getByLabelText('Minimum fame score for People') as HTMLInputElement).value).toBe('90');
});

test('renders the Data Depth switch, showing Curated active for the default values', () => {
  const { getByRole } = renderSidebar({ fameScoreValues: { people: 90, conflicts: 82, milestones: 82 } });

  expect(getByRole('button', { name: 'Curated' }).getAttribute('aria-pressed')).toBe('true');
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
  expect(region?.textContent).toContain('Middle East');
});

test('clicking a Region pill calls onToggleRegion with that region', () => {
  const onToggleRegion = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleRegion });

  fireEvent.click(getByLabelText('Filter by Middle East'));

  expect(onToggleRegion).toHaveBeenCalledWith('middle-east');
});

test('renders the Conflicts & Milestones section with one pill per filter value (Conflicts + 2 Milestone Category Groups), none pressed by default', () => {
  const { getByRole, getByLabelText } = renderSidebar();

  const section = getByRole('heading', { name: 'Conflicts & Milestones' }).closest('section');
  expect(section?.querySelectorAll('li')).toHaveLength(CONFLICTS_MILESTONES_FILTER_VALUES.length);
  expect(section?.textContent).toContain('Science & Innovation');
  expect(getByLabelText('Filter by Conflicts').getAttribute('aria-pressed')).toBe('false');
});

test('clicking a Milestone Category Group pill calls onToggleConflictsMilestonesValue with that group', () => {
  const onToggleConflictsMilestonesValue = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleConflictsMilestonesValue });

  fireEvent.click(getByLabelText('Filter by Social & Human Culture'));

  expect(onToggleConflictsMilestonesValue).toHaveBeenCalledWith('social-culture');
});

test('clicking the Conflicts pill calls onToggleConflictsMilestonesValue with \'conflicts\'', () => {
  const onToggleConflictsMilestonesValue = vi.fn();
  const { getByLabelText } = renderSidebar({ onToggleConflictsMilestonesValue });

  fireEvent.click(getByLabelText('Filter by Conflicts'));

  expect(onToggleConflictsMilestonesValue).toHaveBeenCalledWith('conflicts');
});
