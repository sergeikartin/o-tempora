import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Person } from '../../../shared/types';
import type { DetailPanelEntity } from '../lib/build-drawer-content';
import { DetailPanel, type DetailPanelMember } from './DetailPanel';

afterEach(cleanup);

const closed = {
  members: [] as DetailPanelMember[],
  overlapLine: null,
  isAdding: false,
  onRemoveMember: () => {},
  onOpenConnection: () => {},
};

function open(entity: DetailPanelEntity, isHidden = false) {
  return { ...closed, members: [{ entity, isHidden }] };
}

const napoleon: Person = {
  id: '69880',
  slug: '69880',
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

test('renders an inert, contentless panel when selected is null', () => {
  const { container } = render(<DetailPanel {...closed} onClose={() => {}} />);
  const panel = container.querySelector('aside');
  expect(panel).toBeTruthy();
  expect(panel?.hasAttribute('inert')).toBe(true);
  expect(panel?.textContent).toBe('');
});

test('renders name, tagline, image, credit line, and a Wikipedia link', () => {
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={() => {}}
    />,
  );

  expect(screen.getByText('Napoleon')).toBeTruthy();
  expect(
    screen.getByText('French military commander and emperor'),
  ).toBeTruthy();
  expect(
    screen.getByText('Jacques-Louis David, via Wikimedia Commons'),
  ).toBeTruthy();
  const image = screen.getByRole('img') as HTMLImageElement;
  expect(image.src).toContain('Napoleon.jpg?width=400');
  const link = screen.getByRole('link', {
    name: /Wikipedia/,
  }) as HTMLAnchorElement;
  expect(link.href).toBe('https://en.wikipedia.org/wiki/Napoleon');
  expect(link.target).toBe('_blank');
});

test('does not render a date line for a person (tagline already carries dates)', () => {
  const { container } = render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={() => {}}
    />,
  );
  expect(container.querySelector('[class*="dateLine"]')).toBeNull();
});

test('renders description as a body paragraph, below the tagline subtitle, when present', () => {
  const withDescription = {
    ...napoleon,
    description:
      'Napoleon Bonaparte was a French military commander and political leader.',
  };
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: withDescription })}
      onClose={() => {}}
    />,
  );

  expect(
    screen.getByText('French military commander and emperor'),
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Napoleon Bonaparte was a French military commander and political leader.',
    ),
  ).toBeTruthy();
});

test('shows the tagline subtitle alone, with no empty/placeholder body paragraph, when description is absent', () => {
  const { container } = render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={() => {}}
    />,
  );

  expect(
    screen.getByText('French military commander and emperor'),
  ).toBeTruthy();
  const emptyParagraphs = Array.from(container.querySelectorAll('p')).filter(
    (p) => p.textContent === '',
  );
  expect(emptyParagraphs.length).toBe(0);
});

test('omits the image slot entirely when the entity has no image', () => {
  render(
    <DetailPanel
      {...open({
        entityType: 'person',
        entity: { ...napoleon, image: undefined, imageAttribution: undefined },
      })}
      onClose={() => {}}
    />,
  );
  expect(screen.queryByRole('img')).toBeNull();
});

test('hides the image (and its credit line) after the <img> fails to load at runtime', () => {
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={() => {}}
    />,
  );

  fireEvent.error(screen.getByRole('img'));

  expect(screen.queryByRole('img')).toBeNull();
  expect(
    screen.queryByText('Jacques-Louis David, via Wikimedia Commons'),
  ).toBeNull();
});

test("a different entity sharing the exact same image URL still gets a fresh attempt after another entity's image failed", () => {
  const napoleonTwin: typeof napoleon = {
    ...napoleon,
    id: 'Q-other',
    name: 'Someone Else',
  };
  const { rerender } = render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={() => {}}
    />,
  );

  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).toBeNull();

  rerender(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleonTwin })}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole('img')).toBeTruthy();
});

test('clicking the close button calls onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.click(screen.getByLabelText('Close details'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('pressing Escape calls onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking outside the panel calls onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.pointerDown(document.body, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(document.body, { clientX: 0, clientY: 0 });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clicking inside the panel does not call onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.pointerDown(screen.getByText('Napoleon'), {
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerUp(screen.getByText('Napoleon'), { clientX: 0, clientY: 0 });
  expect(onClose).not.toHaveBeenCalled();
});

test('dragging outside the panel (e.g. panning the timeline) does not call onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.pointerDown(document.body, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(document.body, { clientX: 50, clientY: 0 });
  expect(onClose).not.toHaveBeenCalled();
});

// The mobile sheet only covers 80vh (DetailPanel.module.css), leaving a
// strip of the timeline's own tappable marks exposed above it — this
// backdrop covers that strip so a dismiss tap can't land on a mark
// underneath and open a different entity instead of closing this one.
test('clicking the mobile backdrop calls onClose', () => {
  const onClose = vi.fn();
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon })}
      onClose={onClose}
    />,
  );

  fireEvent.click(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('no backdrop is rendered when the panel is closed', () => {
  render(<DetailPanel {...closed} onClose={() => {}} />);

  expect(screen.queryByLabelText('Close')).toBeNull();
});

const wellington: Person = {
  id: 'wellington',
  slug: 'wellington',
  name: 'Wellington',
  lifespan: { start: { year: 1769, month: 5 }, end: { year: 1852, month: 9 } },
  occupationDomain: 'institutions',
  regionTags: [],
  fameScore: 95,
  tagline: 'British field marshal',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Wellington',
};

function comparison(
  overrides: Partial<Parameters<typeof DetailPanel>[0]> = {},
) {
  return {
    ...closed,
    members: [
      { entity: { entityType: 'person', entity: napoleon }, isHidden: false },
      { entity: { entityType: 'person', entity: wellington }, isHidden: false },
    ] as DetailPanelMember[],
    overlapLine: 'Overlap: May 1769 – 1821',
    onClose: () => {},
    ...overrides,
  };
}

test('two members list each in short form under the overlap line, without a banner image or description', () => {
  const { container } = render(<DetailPanel {...comparison()} />);

  expect(screen.getByText('Overlap: May 1769 – 1821')).toBeTruthy();
  const items = screen.getAllByRole('listitem');
  expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
    'Napoleon',
    'Wellington',
  ]);
  expect(screen.getByText('May 1769 – Sep 1852')).toBeTruthy();
  expect(screen.getByText('British field marshal')).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /Wikipedia/ })).toHaveLength(2);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(container.querySelector('img')?.getAttribute('src')).toContain(
    'width=96',
  );
  expect(
    screen.getByRole('complementary', { name: 'Comparison details' }),
  ).toBeTruthy();
});

test('a member filtered off the canvas says so, and its × removes it', () => {
  const onRemoveMember = vi.fn();
  const props = comparison({ onRemoveMember });
  props.members = [
    props.members[0] as DetailPanelMember,
    { ...(props.members[1] as DetailPanelMember), isHidden: true },
  ];
  render(<DetailPanel {...props} />);

  expect(screen.getAllByText('Hidden by filters')).toHaveLength(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Wellington from comparison' }),
  );
  expect(onRemoveMember).toHaveBeenCalledWith('wellington');
});

test('a hidden single member is noted under its tagline', () => {
  render(
    <DetailPanel
      {...open({ entityType: 'person', entity: napoleon }, true)}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText('Hidden by filters')).toBeTruthy();
});

test('an ongoing life is listed through to the present', () => {
  const living: Person = {
    ...wellington,
    id: 'living',
    slug: 'living',
    name: 'Living',
    lifespan: { start: { year: 1955, month: 2 } },
  };
  const props = comparison();
  props.members = [
    props.members[0] as DetailPanelMember,
    { entity: { entityType: 'person', entity: living }, isHidden: false },
  ];
  render(<DetailPanel {...props} />);
  expect(screen.getByText('Feb 1955 – present')).toBeTruthy();
});

test('a comparison member with an image shows it as a small thumbnail, and a broken one is dropped', () => {
  const withImage: Person = {
    ...wellington,
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Wellington.jpg',
    imageAttribution: 'Thomas Lawrence, via Wikimedia Commons',
  };
  const props = comparison();
  props.members = [
    {
      entity: {
        entityType: 'person',
        entity: { ...napoleon, image: undefined },
      },
      isHidden: false,
    },
    { entity: { entityType: 'person', entity: withImage }, isHidden: false },
  ];
  const { container } = render(<DetailPanel {...props} />);

  const thumbs = container.querySelectorAll('li img');
  expect(thumbs).toHaveLength(1);
  expect((thumbs[0] as HTMLImageElement).src).toContain(
    'Wellington.jpg?width=96',
  );
  expect(thumbs[0]?.getAttribute('title')).toBe(
    'Thomas Lawrence, via Wikimedia Commons',
  );

  fireEvent.error(thumbs[0] as Element);
  expect(container.querySelectorAll('li img')).toHaveLength(0);
});

test('the panel itself has no add button; adding lives on the canvas', () => {
  render(<DetailPanel {...comparison()} />);
  expect(
    screen.queryByRole('button', { name: 'Add to comparison' }),
  ).toBeNull();
});
