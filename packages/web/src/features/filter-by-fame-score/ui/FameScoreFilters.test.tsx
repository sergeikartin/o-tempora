import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { FameScoreFilters } from './FameScoreFilters';

afterEach(cleanup);

const values = { people: 90, conflicts: 100, milestones: 200 };

test('renders one labeled number input per lane, showing the current value', () => {
  const { getByLabelText } = render(
    <FameScoreFilters values={values} onChange={vi.fn()} />,
  );

  expect(
    (getByLabelText('Minimum fame score for People') as HTMLInputElement).value,
  ).toBe('90');
  expect(
    (getByLabelText('Minimum fame score for Conflicts') as HTMLInputElement)
      .value,
  ).toBe('100');
  expect(
    (getByLabelText('Minimum fame score for Milestones') as HTMLInputElement)
      .value,
  ).toBe('200');
});

test("editing a lane's input calls onChange with that lane and the new numeric value", () => {
  const onChange = vi.fn();
  const { getByLabelText } = render(
    <FameScoreFilters values={values} onChange={onChange} />,
  );

  fireEvent.change(getByLabelText('Minimum fame score for People'), {
    target: { value: '95' },
  });

  expect(onChange).toHaveBeenCalledWith('people', 95);
});

test('renders the filtered entry count next to each lane when counts are given', () => {
  const counts = { people: 42, conflicts: 7, milestones: 13 };
  const { getByText } = render(
    <FameScoreFilters values={values} onChange={vi.fn()} counts={counts} />,
  );

  expect(getByText('42')).toBeTruthy();
  expect(getByText('7')).toBeTruthy();
  expect(getByText('13')).toBeTruthy();
});

test('renders no counts when counts is omitted', () => {
  const { container } = render(
    <FameScoreFilters values={values} onChange={vi.fn()} />,
  );

  expect(container.querySelectorAll('[class*="filterCount"]')).toHaveLength(0);
});
