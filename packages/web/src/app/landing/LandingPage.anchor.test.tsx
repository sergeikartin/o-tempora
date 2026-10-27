import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LandingPage } from './LandingPage';

vi.mock('./curiosities', async (importOriginal) => {
  const original = await importOriginal<typeof import('./curiosities')>();
  const [first, ...rest] = original.CURIOSITIES;
  return {
    ...original,
    CURIOSITIES: [{ ...first, anchor: { kind: 'fact', index: 2 } }, ...rest],
  };
});

afterEach(cleanup);

test('ends the call-to-action in the anchor fragment of a Curiosity that has one', () => {
  render(<LandingPage />);
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=albert-einstein#fact-2');
});
