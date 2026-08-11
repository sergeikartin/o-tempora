import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { test, expect, afterEach, vi } from 'vitest';
import { DetailPanel } from './DetailPanel';
import type { Person } from '../../../shared/types';

afterEach(cleanup);

const napoleon: Person = {
  id: '69880',
  name: 'Napoleon',
  lifespan: { start: { year: 1769 }, end: { year: 1821 } },
  occupationDomain: 'institutions',
  regionTags: [],
  fameScore: 100,
  tagline: 'French military commander and emperor',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Napoleon',
  image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Napoleon.jpg',
  imageAttribution: 'Jacques-Louis David, via Wikimedia Commons',
};

test('renders nothing when selected is null', () => {
  const { container } = render(<DetailPanel selected={null} onClose={() => {}} />);
  expect(container.innerHTML).toBe('');
});

test('renders name, date line, tagline, image, credit line, and a Wikipedia link', () => {
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={() => {}} />);

  expect(screen.getByText('Napoleon')).toBeTruthy();
  expect(screen.getByText('French military commander and emperor')).toBeTruthy();
  expect(screen.getByText('Jacques-Louis David, via Wikimedia Commons')).toBeTruthy();
  const image = screen.getByRole('img') as HTMLImageElement;
  expect(image.src).toContain('Napoleon.jpg?width=400');
  const link = screen.getByRole('link', { name: /Wikipedia/ }) as HTMLAnchorElement;
  expect(link.href).toBe('https://en.wikipedia.org/wiki/Napoleon');
  expect(link.target).toBe('_blank');
});

test('renders description as a body paragraph, below the tagline subtitle, when present', () => {
  const withDescription = {
    ...napoleon,
    description: 'Napoleon Bonaparte was a French military commander and political leader.',
  };
  render(<DetailPanel selected={{ entityType: 'person', entity: withDescription }} onClose={() => {}} />);

  expect(screen.getByText('French military commander and emperor')).toBeTruthy();
  expect(screen.getByText('Napoleon Bonaparte was a French military commander and political leader.')).toBeTruthy();
});

test('shows the tagline subtitle alone, with no empty/placeholder body paragraph, when description is absent', () => {
  const { container } = render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={() => {}} />);

  expect(screen.getByText('French military commander and emperor')).toBeTruthy();
  const emptyParagraphs = Array.from(container.querySelectorAll('p')).filter((p) => p.textContent === '');
  expect(emptyParagraphs.length).toBe(0);
});

test('omits the image slot entirely when the entity has no image', () => {
  render(
    <DetailPanel
      selected={{ entityType: 'person', entity: { ...napoleon, image: undefined, imageAttribution: undefined } }}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByRole('img')).toBeNull();
});

test('hides the image (and its credit line) after the <img> fails to load at runtime', () => {
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={() => {}} />);

  fireEvent.error(screen.getByRole('img'));

  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByText('Jacques-Louis David, via Wikimedia Commons')).toBeNull();
});

test('a different entity sharing the exact same image URL still gets a fresh attempt after another entity\'s image failed', () => {
  const napoleonTwin: typeof napoleon = { ...napoleon, id: 'Q-other', name: 'Someone Else' };
  const { rerender } = render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={() => {}} />);

  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).toBeNull();

  rerender(<DetailPanel selected={{ entityType: 'person', entity: napoleonTwin }} onClose={() => {}} />);
  expect(screen.getByRole('img')).toBeTruthy();
});

test('clicking the close button calls onClose', () => {
  const onClose = vi.fn();
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={onClose} />);

  fireEvent.click(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('pressing Escape calls onClose', () => {
  const onClose = vi.fn();
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={onClose} />);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking outside the panel calls onClose', () => {
  const onClose = vi.fn();
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={onClose} />);

  fireEvent.pointerDown(document.body, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(document.body, { clientX: 0, clientY: 0 });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking inside the panel does not call onClose', () => {
  const onClose = vi.fn();
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={onClose} />);

  fireEvent.pointerDown(screen.getByText('Napoleon'), { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(screen.getByText('Napoleon'), { clientX: 0, clientY: 0 });
  expect(onClose).not.toHaveBeenCalled();
});

test('dragging outside the panel (e.g. panning the timeline) does not call onClose', () => {
  const onClose = vi.fn();
  render(<DetailPanel selected={{ entityType: 'person', entity: napoleon }} onClose={onClose} />);

  fireEvent.pointerDown(document.body, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(document.body, { clientX: 50, clientY: 0 });
  expect(onClose).not.toHaveBeenCalled();
});
