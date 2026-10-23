import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { HelpPanel } from './HelpPanel';

afterEach(cleanup);

test('renders nothing when closed', () => {
  const { container } = render(<HelpPanel isOpen={false} onClose={vi.fn()} />);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test('explains how to travel, read marks and use the keys when open', () => {
  const { getByRole, getByText } = render(
    <HelpPanel isOpen={true} onClose={vi.fn()} />,
  );

  expect(
    getByRole('dialog', { name: 'How to read the timeline' }),
  ).toBeTruthy();
  expect(getByText('Lines and dots')).toBeTruthy();
  expect(getByText(/Press \? to open this help/)).toBeTruthy();
});

test('calls onClose on Escape and from the close button', () => {
  const onClose = vi.fn();
  const { getByLabelText } = render(
    <HelpPanel isOpen={true} onClose={onClose} />,
  );

  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(getByLabelText('Close help'));

  expect(onClose).toHaveBeenCalledTimes(2);
});
