import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { HelpPanel } from './HelpPanel';

afterEach(cleanup);

function renderHelp(overrides: Partial<Parameters<typeof HelpPanel>[0]> = {}) {
  return render(
    <HelpPanel
      isOpen={true}
      onClose={vi.fn()}
      onOpenAbout={vi.fn()}
      {...overrides}
    />,
  );
}

test('renders nothing when closed', () => {
  const { container } = renderHelp({ isOpen: false });
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test('explains how to travel, read marks and use the keys when open', () => {
  const { getByRole, getByText } = renderHelp();

  expect(
    getByRole('dialog', { name: 'How to read the timeline' }),
  ).toBeTruthy();
  expect(getByText('Lines and dots')).toBeTruthy();
  expect(getByText(/Press \? to open this help/)).toBeTruthy();
});

test('calls onClose on Escape and from the close button', () => {
  const onClose = vi.fn();
  const { getByLabelText } = renderHelp({ onClose });

  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(getByLabelText('Close help'));

  expect(onClose).toHaveBeenCalledTimes(2);
});

test('opens About from Help', () => {
  const onOpenAbout = vi.fn();
  const { getByRole, queryByRole } = renderHelp({ onOpenAbout });

  fireEvent.click(getByRole('button', { name: 'About' }));

  expect(onOpenAbout).toHaveBeenCalledTimes(1);
  expect(queryByRole('link', { name: 'Русский' })).toBeNull();
});
