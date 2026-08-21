import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DataDepthSwitch } from './DataDepthSwitch';

afterEach(cleanup);

test('shows Mainstream as active for the default values', () => {
  const { getByRole } = render(
    <DataDepthSwitch
      values={{ people: 88, conflicts: 82, milestones: 82 }}
      onSelectLevel={vi.fn()}
    />,
  );

  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    getByRole('button', { name: 'Deep Cut' }).getAttribute('aria-pressed'),
  ).toBe('false');
});

test('shows no level active when values match no preset row (custom)', () => {
  const { getByRole } = render(
    <DataDepthSwitch
      values={{ people: 84, conflicts: 70, milestones: 70 }}
      onSelectLevel={vi.fn()}
    />,
  );

  expect(
    getByRole('button', { name: 'Mainstream' }).getAttribute('aria-pressed'),
  ).toBe('false');
  expect(
    getByRole('button', { name: 'Deep Cut' }).getAttribute('aria-pressed'),
  ).toBe('false');
});

test('clicking a level calls onSelectLevel once with that level', () => {
  const onSelectLevel = vi.fn();
  const { getByRole } = render(
    <DataDepthSwitch
      values={{ people: 88, conflicts: 82, milestones: 82 }}
      onSelectLevel={onSelectLevel}
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
