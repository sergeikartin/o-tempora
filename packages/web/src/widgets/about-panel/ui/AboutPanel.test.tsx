import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AboutPanel } from './AboutPanel';

afterEach(cleanup);

test('renders nothing when closed', () => {
  const { container } = render(<AboutPanel isOpen={false} onClose={vi.fn()} />);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test('renders the data-attribution links when open', () => {
  const { getByRole } = render(<AboutPanel isOpen={true} onClose={vi.fn()} />);

  expect(getByRole('dialog')).toBeTruthy();
  expect(
    getByRole('link', { name: /View source on GitHub/ }).getAttribute('href'),
  ).toBe('https://github.com/sergeikartin/o-tempora/blob/main/LICENSE');
  expect(
    getByRole('link', { name: /Full data license/ }).getAttribute('href'),
  ).toBe(
    'https://github.com/sergeikartin/o-tempora/blob/main/packages/shared-types/LICENSE-DATA.md',
  );
});

test('calls onClose when the backdrop is clicked', () => {
  const onClose = vi.fn();
  const { getByLabelText } = render(
    <AboutPanel isOpen={true} onClose={onClose} />,
  );

  fireEvent.click(getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('calls onClose on Escape', () => {
  const onClose = vi.fn();
  render(<AboutPanel isOpen={true} onClose={onClose} />);

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(onClose).toHaveBeenCalledTimes(1);
});
