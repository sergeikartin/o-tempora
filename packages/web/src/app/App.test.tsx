import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders without throwing and includes the hidden heading', () => {
  expect(() => render(<App />)).not.toThrow();
  expect(
    screen.getByText('Every life in context', { selector: 'h1' }),
  ).toBeTruthy();
});
