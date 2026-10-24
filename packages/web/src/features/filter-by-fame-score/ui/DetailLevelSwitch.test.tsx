import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DetailLevelSwitch } from './DetailLevelSwitch';

afterEach(cleanup);

const TRIGGER_NAME = /^Detail Level/;

function renderSwitch(
  overrides: Partial<Parameters<typeof DetailLevelSwitch>[0]> = {},
) {
  return render(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={vi.fn()}
      loadingLevelIds={[]}
      {...overrides}
    />,
  );
}

test('collapsed, shows only the selected level name on the trigger', () => {
  const { getByRole, queryByRole } = renderSwitch();

  const trigger = getByRole('button', { name: TRIGGER_NAME });
  expect(trigger.textContent).toContain('Mainstream');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(queryByRole('button', { name: /^Legendary/ })).toBeNull();
});

test('opening lists all 4 levels, with the selected one pressed', () => {
  const { getByRole } = renderSwitch();

  fireEvent.click(getByRole('button', { name: TRIGGER_NAME }));

  expect(
    getByRole('button', { name: TRIGGER_NAME }).getAttribute('aria-expanded'),
  ).toBe('true');
  expect(
    getByRole('button', { name: /^Mainstream/ }).getAttribute('aria-pressed'),
  ).toBe('true');
  for (const label of [/^Legendary/, /^Specialized/, /^Deep Cut/]) {
    expect(
      getByRole('button', { name: label }).getAttribute('aria-pressed'),
    ).toBe('false');
  }
});

test('each row carries its level description', () => {
  const { getByRole, getByText } = renderSwitch();

  fireEvent.click(getByRole('button', { name: TRIGGER_NAME }));

  expect(
    getByText(
      'Essential historical figures, key conflicts, and primary milestones.',
    ),
  ).toBeTruthy();
  expect(
    getByText(
      'Displays high-density details, including niche figures, minor conflicts, and obscure milestones.',
    ),
  ).toBeTruthy();
});

test('picking a level calls onSelectLevel once with that level and closes', () => {
  const onSelectLevel = vi.fn();
  const { getByRole, queryByRole } = renderSwitch({ onSelectLevel });

  fireEvent.click(getByRole('button', { name: TRIGGER_NAME }));
  fireEvent.click(getByRole('button', { name: /^Deep Cut/ }));

  expect(onSelectLevel).toHaveBeenCalledTimes(1);
  expect(onSelectLevel).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'deep-cut',
      values: { people: 80, conflicts: 64, milestones: 55 },
    }),
  );
  expect(queryByRole('button', { name: /^Legendary/ })).toBeNull();
});

test('Escape and an outside press both close the list', () => {
  const { getByRole, queryByRole } = renderSwitch();
  const open = () =>
    fireEvent.click(getByRole('button', { name: TRIGGER_NAME }));

  open();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(queryByRole('button', { name: /^Legendary/ })).toBeNull();

  open();
  fireEvent.pointerDown(document.body);
  expect(queryByRole('button', { name: /^Legendary/ })).toBeNull();
});

test('marks the trigger busy only when the selected level is still loading', () => {
  const { getByRole, rerender } = renderSwitch({
    selectedLevelId: 'deep-cut',
    loadingLevelIds: ['deep-cut'],
  });
  expect(
    getByRole('button', { name: TRIGGER_NAME }).getAttribute('aria-busy'),
  ).toBe('true');

  rerender(
    <DetailLevelSwitch
      selectedLevelId="mainstream"
      onSelectLevel={vi.fn()}
      loadingLevelIds={['deep-cut']}
    />,
  );
  expect(
    getByRole('button', { name: TRIGGER_NAME }).getAttribute('aria-busy'),
  ).not.toBe('true');
});

test('describes the control with the fixed hint', () => {
  const { getByRole, getByText } = renderSwitch();

  const hint = getByText('How much to show, most famous first.');
  expect(getByRole('group').getAttribute('aria-describedby')).toBe(hint.id);
});
