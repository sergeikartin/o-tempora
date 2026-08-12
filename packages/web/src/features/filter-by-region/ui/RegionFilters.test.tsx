import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { RegionFilters } from './RegionFilters';

afterEach(cleanup);

test('renders one toggle pill per Region, none pressed by default', () => {
  const { getByLabelText } = render(<RegionFilters selectedRegions={[]} onToggleRegion={vi.fn()} />);

  expect(getByLabelText('Filter by Europe').getAttribute('aria-pressed')).toBe('false');
  expect(getByLabelText('Filter by Middle East').getAttribute('aria-pressed')).toBe('false');
});

test('marks selected regions as pressed', () => {
  const { getByLabelText } = render(<RegionFilters selectedRegions={['europe']} onToggleRegion={vi.fn()} />);

  expect(getByLabelText('Filter by Europe').getAttribute('aria-pressed')).toBe('true');
  expect(getByLabelText('Filter by Africa').getAttribute('aria-pressed')).toBe('false');
});

test('clicking a pill calls onToggleRegion with that region', () => {
  const onToggleRegion = vi.fn();
  const { getByLabelText } = render(<RegionFilters selectedRegions={[]} onToggleRegion={onToggleRegion} />);

  fireEvent.click(getByLabelText('Filter by East Asia'));

  expect(onToggleRegion).toHaveBeenCalledWith('east-asia');
});
