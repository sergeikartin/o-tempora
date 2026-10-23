import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LandingPage } from './LandingPage';

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});

test('links the call-to-action to the timeline and the language switch to the sibling landing', () => {
  render(<LandingPage />);
  expect(
    screen
      .getByRole('link', { name: 'Explore the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/');
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

  fireEvent.focus(screen.getByRole('link', { name: 'Explore the timeline' }));

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
      'Albert Einstein and Steve Jobs were alive at the same time.',
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

test('links each mark of the open curiosity to its entity on the timeline', () => {
  render(<LandingPage />);
  const hrefs = screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
  expect(hrefs).toContain('/timeline/?e=albert-einstein');
  expect(hrefs).toContain('/timeline/?e=steve-jobs');
});
