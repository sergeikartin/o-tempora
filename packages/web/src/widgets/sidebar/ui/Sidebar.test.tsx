import { cleanup, render } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { Sidebar } from './Sidebar';
import { OCCUPATION_DOMAINS } from '../../../shared/types';

afterEach(cleanup);

const fameScoreValues = { people: 90, conflicts: 100, milestones: 200 };

test('renders one Legend pill per OccupationDomain', () => {
  const { container } = render(
    <Sidebar fameScoreValues={fameScoreValues} onFameScoreChange={vi.fn()} />,
  );

  const pills = container.querySelectorAll('li');
  expect(pills).toHaveLength(OCCUPATION_DOMAINS.length);
  expect(container.textContent).toContain('Science & Technology');
});

test('renders the fame-score filter inputs, pre-filled with the given values', () => {
  const { getByLabelText } = render(
    <Sidebar fameScoreValues={fameScoreValues} onFameScoreChange={vi.fn()} />,
  );

  expect((getByLabelText('Minimum fame score for People') as HTMLInputElement).value).toBe('90');
});
