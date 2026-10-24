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
      switchLanguageHref="/ru/timeline/"
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

test('keeps About and the language switch, which no longer live in the Top Bar', () => {
  const onOpenAbout = vi.fn();
  const { getByRole } = renderHelp({
    onOpenAbout,
    switchLanguageHref: '/ru/timeline/?e=albert-einstein',
  });

  fireEvent.click(getByRole('button', { name: 'About' }));

  expect(onOpenAbout).toHaveBeenCalledTimes(1);
  expect(getByRole('link', { name: 'Русский' }).getAttribute('href')).toBe(
    '/ru/timeline/?e=albert-einstein',
  );
});
