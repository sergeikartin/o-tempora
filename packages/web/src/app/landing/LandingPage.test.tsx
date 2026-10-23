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

test('links the call-to-action to the open curiosity on the timeline and the language switch to the sibling landing', () => {
  render(<LandingPage />);
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=albert-einstein');
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
      'Steve Jobs was born two months before Albert Einstein died.',
    ),
  ).toBeTruthy();
  expect(screen.getByText(/Jobs was born in February 1955/)).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Einstein & Jobs' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('picking another curiosity swaps the sentence and redraws the marks', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Monet & Monroe' }));
  expect(screen.getByText('1840 – 1926')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Monet & Monroe' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    screen
      .getByRole('button', { name: 'Einstein & Jobs' })
      .getAttribute('aria-pressed'),
  ).toBe('false');
});

test('stepping through curiosities wraps around both ends', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Previous curious overlap' }),
  );
  expect(
    screen
      .getByRole('button', { name: 'Joan & Vlad' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Next curious overlap' }));
  expect(
    screen
      .getByRole('button', { name: 'Einstein & Jobs' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('links each mark of the open curiosity to its entity on the timeline', () => {
  render(<LandingPage />);
  const hrefs = screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
  expect(hrefs).toContain('/timeline/?e=albert-einstein');
  expect(hrefs).toContain('/timeline/?e=steve-jobs');
});

test('retargets the call-to-action when another curiosity is picked', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Monet & Monroe' }));
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=claude-monet');
});

test('keeps the picked curiosity in the hash and carries it to the sibling landing', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Jefferson & Adams' }));
  expect(window.location.hash).toBe('#jefferson-adams');
  expect(
    screen.getByRole('link', { name: 'Русский' }).getAttribute('href'),
  ).toBe('/ru/#jefferson-adams');
});

test('opens on the curiosity named in the hash', () => {
  window.history.replaceState(null, '', '/#year-1564');
  render(<LandingPage />);
  expect(
    screen
      .getByRole('button', { name: 'Michelangelo & Galileo' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('arrow keys move through the chips, which are a single tab stop', () => {
  render(<LandingPage />);
  const first = screen.getByRole('button', { name: 'Einstein & Jobs' });
  const second = screen.getByRole('button', { name: 'Monet & Monroe' });
  expect(first.tabIndex).toBe(0);
  expect(second.tabIndex).toBe(-1);
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(second.getAttribute('aria-pressed')).toBe('true');
  expect(document.activeElement).toBe(second);
  expect(second.tabIndex).toBe(0);
});

test('tracks the picked curiosity with the control that picked it', () => {
  render(<LandingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Monet & Monroe' }));
  expect(trackEvent).toHaveBeenLastCalledWith('landing_curiosity_select', {
    curiosity: 'monet-monroe',
    method: 'chip',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next curious overlap' }));
  expect(trackEvent).toHaveBeenLastCalledWith('landing_curiosity_select', {
    curiosity: 'ali-hawking',
    method: 'stepper',
  });
});

test('does not track the curiosity opened from the hash', () => {
  window.history.replaceState(null, '', '/#year-1564');
  render(<LandingPage />);
  expect(trackEvent).not.toHaveBeenCalled();
});

test('tracks the call-to-action and mark links with the open curiosity', () => {
  render(<LandingPage />);
  fireEvent.click(
    screen.getByRole('link', { name: 'See them on the timeline' }),
  );
  expect(trackEvent).toHaveBeenLastCalledWith('landing_cta_click', {
    curiosity: 'einstein-jobs',
  });
  fireEvent.click(screen.getByRole('link', { name: 'Steve Jobs' }));
  expect(trackEvent).toHaveBeenLastCalledWith('landing_mark_open', {
    curiosity: 'einstein-jobs',
  });
});
