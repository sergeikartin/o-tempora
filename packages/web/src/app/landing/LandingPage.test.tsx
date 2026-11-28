import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { trackEvent } from '../../shared/lib/track-event';
import { LandingPage } from './LandingPage';

vi.mock('../../shared/lib/track-event');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.head.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

test('links the call-to-action to the open curiosity’s lead entity and the language switch to the sibling landing', () => {
  render(<LandingPage />);
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=mary-shelley#moment-2');
  expect(
    screen.getByRole('link', { name: 'Русский' }).getAttribute('href'),
  ).toBe('/ru/');
});

test('prefetches the timeline only once the call-to-action shows intent', () => {
  const manifest = document.createElement('script');
  manifest.type = 'application/json';
  manifest.id = 'timeline-prefetch';
  manifest.textContent = JSON.stringify([
    { href: '/timeline/' },
    { href: '/assets/main-abc.js', as: 'script' },
    { href: '/assets/main-abc.css', as: 'style' },
  ]);
  document.head.append(manifest);
  render(<LandingPage />);
  expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(
    0,
  );

  fireEvent.focus(
    screen.getByRole('link', { name: 'See them on the timeline' }),
  );

  const hrefs = [...document.head.querySelectorAll('link[rel="prefetch"]')].map(
    (link) => link.getAttribute('href'),
  );
  expect(hrefs).toEqual([
    '/timeline/',
    '/assets/main-abc.js',
    '/assets/main-abc.css',
  ]);
});

test('opens on the first curiosity with its sentence and caption', () => {
  render(<LandingPage />);
  expect(
    screen.getByText(
      'Mary Shelley began Frankenstein in the year without a summer.',
    ),
  ).toBeTruthy();
  expect(screen.getByText(/Rain kept the guests indoors/)).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Shelley & Frankenstein' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('picking another curiosity swaps the sentence and redraws the marks', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Vermeer & Leeuwenhoek' }),
  );
  expect(screen.getByText('1632 – 1675')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Vermeer & Leeuwenhoek' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    screen
      .getByRole('button', { name: 'Shelley & Frankenstein' })
      .getAttribute('aria-pressed'),
  ).toBe('false');
});

test('stepping through curiosities wraps around both ends', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Previous connection' }));
  expect(
    screen
      .getByRole('button', { name: 'Curie’s X-ray car' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Next connection' }));
  expect(
    screen
      .getByRole('button', { name: 'Shelley & Frankenstein' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('leaves the marks as plain labels and the call-to-action the only way to the timeline', () => {
  render(<LandingPage />);
  expect(
    screen.queryByRole('link', { name: 'Year Without a Summer' }),
  ).toBeNull();
  const timelineLinks = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('/timeline/'));
  expect(timelineLinks).toHaveLength(1);
});

test('retargets the call-to-action when another curiosity is picked', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Vermeer & Leeuwenhoek' }),
  );
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=johannes-vermeer#fact-1');
});

test('keeps the picked curiosity in the hash and carries it to the sibling landing', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Tolstoy & Gandhi' }));
  expect(window.location.hash).toBe('#tolstoy-gandhi');
  expect(
    screen.getByRole('link', { name: 'Русский' }).getAttribute('href'),
  ).toBe('/ru/#tolstoy-gandhi');
});

test('opens on the curiosity named in the hash', () => {
  window.history.replaceState(null, '', '/#leonardo-michelangelo');
  render(<LandingPage />);
  expect(
    screen
      .getByRole('button', { name: 'Florence’s murals' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('arrow keys move through the chips, which are a single tab stop', () => {
  render(<LandingPage />);
  const first = screen.getByRole('button', { name: 'Shelley & Frankenstein' });
  const second = screen.getByRole('button', { name: 'Vermeer & Leeuwenhoek' });
  expect(first.tabIndex).toBe(0);
  expect(second.tabIndex).toBe(-1);
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(second.getAttribute('aria-pressed')).toBe('true');
  expect(document.activeElement).toBe(second);
  expect(second.tabIndex).toBe(0);
});

test('tracks the picked curiosity with the control that picked it', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Vermeer & Leeuwenhoek' }),
  );
  expect(trackEvent).toHaveBeenLastCalledWith('landing_curiosity_select', {
    curiosity: 'vermeer-leeuwenhoek',
    method: 'chip',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next connection' }));
  expect(trackEvent).toHaveBeenLastCalledWith('landing_curiosity_select', {
    curiosity: 'einstein-szilard',
    method: 'stepper',
  });
});

test('does not track the curiosity opened from the hash', () => {
  window.history.replaceState(null, '', '/#leonardo-michelangelo');
  render(<LandingPage />);
  expect(trackEvent).not.toHaveBeenCalled();
});

test('tracks the call-to-action with the open curiosity', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('link', { name: 'See them on the timeline' }),
  );
  expect(trackEvent).toHaveBeenLastCalledWith('landing_cta_click', {
    curiosity: 'shelley-summer',
  });
});
