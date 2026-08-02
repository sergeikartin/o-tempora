import { render, screen } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

vi.mock('vis-timeline/standalone', () => ({
  Timeline: vi.fn().mockImplementation(function MockTimeline() {
    return { setItems: vi.fn(), destroy: vi.fn(), on: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() };
  }),
}));

vi.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

const { App } = await import('./App');

test('renders without throwing and includes the hidden heading', () => {
  expect(() => render(<App />)).not.toThrow();
  expect(screen.getByText('World History Timeline', { selector: 'h1' })).toBeTruthy();
});
