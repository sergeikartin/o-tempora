import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  CONFLICTS_MILESTONES_FILTER_LABELS,
  CONFLICTS_MILESTONES_FILTER_VALUES,
} from '../../../shared/config';
import { ConflictsMilestonesFilters } from './ConflictsMilestonesFilters';

afterEach(cleanup);

test('renders one toggle pill per filter value (Conflicts + the 2 Milestone Category Groups), none pressed by default', () => {
  const { getByLabelText } = render(
    <ConflictsMilestonesFilters selectedValues={[]} onToggleValue={vi.fn()} />,
  );

  for (const value of CONFLICTS_MILESTONES_FILTER_VALUES) {
    const button = getByLabelText(
      `Filter by ${CONFLICTS_MILESTONES_FILTER_LABELS[value]}`,
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
  }
});

test('marks selected values as pressed', () => {
  const { getByLabelText } = render(
    <ConflictsMilestonesFilters
      selectedValues={['conflicts']}
      onToggleValue={vi.fn()}
    />,
  );

  expect(
    getByLabelText('Filter by Conflicts').getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    getByLabelText('Filter by Science & Innovation').getAttribute(
      'aria-pressed',
    ),
  ).toBe('false');
});

test('clicking a pill calls onToggleValue with that value', () => {
  const onToggleValue = vi.fn();
  const { getByLabelText } = render(
    <ConflictsMilestonesFilters
      selectedValues={[]}
      onToggleValue={onToggleValue}
    />,
  );

  fireEvent.click(getByLabelText('Filter by Social & Human Culture'));

  expect(onToggleValue).toHaveBeenCalledWith('social-culture');
});

test("clicking the Conflicts pill calls onToggleValue with 'conflicts'", () => {
  const onToggleValue = vi.fn();
  const { getByLabelText } = render(
    <ConflictsMilestonesFilters
      selectedValues={[]}
      onToggleValue={onToggleValue}
    />,
  );

  fireEvent.click(getByLabelText('Filter by Conflicts'));

  expect(onToggleValue).toHaveBeenCalledWith('conflicts');
});
