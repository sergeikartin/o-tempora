import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { App } from './App';

test('renders the placeholder heading', () => {
  render(<App />);
  expect(screen.getByText('World History Timeline')).toBeTruthy();
});
