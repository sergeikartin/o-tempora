import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DetailLevelSwitch } from './DetailLevelSwitch';

afterEach(cleanup);

test('shows all 4 level names as labels, with the selected one active', () => {
  const { getByRole } = render(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={vi.fn()}
      loadingLevelIds={[]}
    />,
  );

  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-pressed'),
  ).toBe('true');
  for (const label of ['Legendary', 'Specialized', 'Deep Cut']) {
    expect(
      getByRole('button', { name: label }).getAttribute('aria-pressed'),
    ).toBe('false');
  }
});

test('renders the selected level description as helper text, updating on selection', () => {
  const { getByText, rerender } = render(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={vi.fn()}
      loadingLevelIds={[]}
    />,
  );
  expect(
    getByText(
      'Essential historical figures, key conflicts, and primary milestones.',
    ),
  ).toBeTruthy();

  rerender(
    <DetailLevelSwitch
      selectedLevelId="deep-cut"
      onSelectLevel={vi.fn()}
      loadingLevelIds={[]}
    />,
  );
  expect(
    getByText(
      'Displays high-density details, including niche figures, minor conflicts, and obscure milestones.',
    ),
  ).toBeTruthy();
});

test('clicking a level calls onSelectLevel once with that level', () => {
  const onSelectLevel = vi.fn();
  const { getByRole } = render(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={onSelectLevel}
      loadingLevelIds={[]}
    />,
  );

  fireEvent.click(getByRole('button', { name: 'Deep Cut' }));

  expect(onSelectLevel).toHaveBeenCalledTimes(1);
  expect(onSelectLevel).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'deep-cut',
      values: { people: 80, conflicts: 64, milestones: 55 },
    }),
  );
});

test('shows a spinner only on the active option when its level is still loading', () => {
  const { getByRole } = render(
    <DetailLevelSwitch
      selectedLevelId="deep-cut"
      onSelectLevel={vi.fn()}
      loadingLevelIds={['deep-cut']}
    />,
  );

  expect(
    getByRole('button', { name: /Deep Cut/ }).getAttribute('aria-busy'),
  ).toBe('true');
  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-busy'),
  ).not.toBe('true');
});

test('shows no spinner when the active level is not in loadingLevelIds', () => {
  const { getByRole } = render(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={vi.fn()}
      loadingLevelIds={['deep-cut']}
    />,
  );

  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-busy'),
  ).not.toBe('true');
});
