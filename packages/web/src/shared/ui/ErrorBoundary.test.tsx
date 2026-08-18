import { render, screen } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders children when nothing throws', () => {
  render(
    <ErrorBoundary fallback={<div>fallback</div>}>
      <div>content</div>
    </ErrorBoundary>,
  );

  expect(screen.getByText('content')).toBeTruthy();
});

test('renders the fallback and logs when a child throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary fallback={<div>fallback</div>}>
      <Bomb />
    </ErrorBoundary>,
  );

  expect(screen.getByText('fallback')).toBeTruthy();
  expect(console.error).toHaveBeenCalled();
});
