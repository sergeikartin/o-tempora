import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { App } from './App';

test('renders without throwing and includes the hidden heading', () => {
  expect(() => render(<App />)).not.toThrow();
  expect(screen.getByText('World History Timeline', { selector: 'h1' })).toBeTruthy();
});
