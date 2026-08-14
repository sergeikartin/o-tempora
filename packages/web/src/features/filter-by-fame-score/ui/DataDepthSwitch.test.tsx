import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { DataDepthSwitch } from './DataDepthSwitch';

afterEach(cleanup);

test('shows Curated as active for the default values', () => {
  const { getByRole } = render(
    <DataDepthSwitch values={{ people: 90, conflicts: 82, milestones: 82 }} onChange={vi.fn()} />,
  );

  expect(getByRole('button', { name: 'Curated' }).getAttribute('aria-pressed')).toBe('true');
  expect(getByRole('button', { name: 'Expanded' }).getAttribute('aria-pressed')).toBe('false');
  expect(getByRole('button', { name: 'Full' }).getAttribute('aria-pressed')).toBe('false');
});

test('shows no level active when values match no preset row (custom)', () => {
  const { getByRole } = render(
    <DataDepthSwitch values={{ people: 88, conflicts: 75, milestones: 75 }} onChange={vi.fn()} />,
  );

  expect(getByRole('button', { name: 'Curated' }).getAttribute('aria-pressed')).toBe('false');
  expect(getByRole('button', { name: 'Expanded' }).getAttribute('aria-pressed')).toBe('false');
  expect(getByRole('button', { name: 'Full' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking a level calls onChange once per lane with that level\'s values', () => {
  const onChange = vi.fn();
  const { getByRole } = render(
    <DataDepthSwitch values={{ people: 90, conflicts: 82, milestones: 82 }} onChange={onChange} />,
  );

  fireEvent.click(getByRole('button', { name: 'Full' }));

  expect(onChange).toHaveBeenCalledWith('people', 80);
  expect(onChange).toHaveBeenCalledWith('conflicts', 1);
  expect(onChange).toHaveBeenCalledWith('milestones', 1);
  expect(onChange).toHaveBeenCalledTimes(3);
});
