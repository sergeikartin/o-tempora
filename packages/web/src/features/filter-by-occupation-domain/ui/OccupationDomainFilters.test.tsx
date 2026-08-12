import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { OccupationDomainFilters } from './OccupationDomainFilters';
import { OCCUPATION_DOMAINS } from '../../../shared/types';
import { DOMAIN_LABELS } from '../../../shared/config';

afterEach(cleanup);

test('renders one toggle pill per OccupationDomain, none pressed by default', () => {
  const { getByLabelText } = render(
    <OccupationDomainFilters selectedDomains={[]} onToggleDomain={vi.fn()} />,
  );

  for (const domain of OCCUPATION_DOMAINS) {
    const button = getByLabelText(`Filter by ${DOMAIN_LABELS[domain]}`) as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
  }
});

test('marks selected domains as pressed', () => {
  const { getByLabelText } = render(
    <OccupationDomainFilters selectedDomains={['science-technology']} onToggleDomain={vi.fn()} />,
  );

  expect(getByLabelText('Filter by Science & Technology').getAttribute('aria-pressed')).toBe('true');
  expect(getByLabelText('Filter by Arts').getAttribute('aria-pressed')).toBe('false');
});

test('clicking a pill calls onToggleDomain with that domain', () => {
  const onToggleDomain = vi.fn();
  const { getByLabelText } = render(
    <OccupationDomainFilters selectedDomains={[]} onToggleDomain={onToggleDomain} />,
  );

  fireEvent.click(getByLabelText('Filter by Arts'));

  expect(onToggleDomain).toHaveBeenCalledWith('arts');
});
