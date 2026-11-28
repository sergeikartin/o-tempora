import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LandingPage } from './LandingPage';

afterEach(cleanup);

test('ends the call-to-action in the anchor fragment of a Curiosity that has one', () => {
  window.history.replaceState(null, '', '/#october-calendar');
  render(<LandingPage />);
  expect(
    screen
      .getByRole('link', { name: 'See them on the timeline' })
      .getAttribute('href'),
  ).toBe('/timeline/?e=gregorian-calendar#moment-4');
});
