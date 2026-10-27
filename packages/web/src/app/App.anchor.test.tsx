import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Person } from '../shared/types';
import type { LocaleDatasets } from './locale-datasets';

function person(id: string, fameScore: number): Person {
  return {
    id,
    slug: `slug-of-${id}`,
    name: id,
    lifespan: { start: { year: 1800 }, end: { year: 1850 } },
    occupationDomain: 'institutions',
    regionTags: [],
    fameScore,
    tagline: `tagline of ${id}`,
    wikipediaUrl: `https://en.wikipedia.org/wiki/${id}`,
    hasProfile: true,
  };
}

const base: LocaleDatasets = {
  people: [person('origin', 95), person('other', 92)],
  conflicts: [],
  milestones: [],
};

const profiles: Record<string, unknown> = {
  'slug-of-origin': {
    overview: 'overview of origin',
    keyMoments: [
      { date: '1801', title: 'first moment', text: 'a' },
      { date: '1802', title: 'second moment', text: 'b' },
    ],
    deepFacts: [
      { text: 'first fact', isLegend: false },
      { text: 'second fact', isLegend: false },
    ],
    connections: [
      {
        slug: 'slug-of-other',
        name: 'other',
        reason: 'why other',
        lane: 'people',
        detailLevel: 2,
      },
    ],
  },
  'slug-of-other': {
    overview: 'overview of other',
    keyMoments: [{ date: '1803', title: 'other moment', text: 'c' }],
    deepFacts: [],
    connections: [],
  },
};

const scrollIntoView = vi.fn();

async function renderApp() {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const slug = url.replace(/^.*\//, '').replace('.json', '');
      return Promise.resolve({
        ok: slug in profiles,
        json: () => Promise.resolve(profiles[slug]),
      });
    }),
  );
  vi.doMock('./locale-datasets', () => ({
    localeDatasetsPromise: Promise.resolve(base),
    level3DatasetPromise: Promise.resolve({ ...base, people: [] }),
    level4DatasetPromise: Promise.resolve({ ...base, people: [] }),
    requestLevel3Load: () => {},
    requestLevel4Load: () => {},
  }));
  const rtl = await import('@testing-library/react');
  const { App } = await import('./App');
  let view!: ReturnType<typeof rtl.render>;
  await act(async () => {
    view = rtl.render(<App />);
  });
  return { ...view, rtl };
}

function panelText(container: HTMLElement) {
  return Array.from(container.querySelectorAll('aside'))
    .filter((aside) => !aside.hasAttribute('inert'))
    .map((aside) => aside.textContent)
    .join(' ');
}

function anchoredItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-anchored]')).map(
    (item) => item.textContent,
  );
}

async function openOrigin(hash: string) {
  window.history.replaceState(null, '', `/?e=slug-of-origin${hash}`);
  const view = await renderApp();
  await waitFor(() =>
    expect(panelText(view.container)).toContain('overview of origin'),
  );
  return view;
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.doUnmock('./locale-datasets');
  vi.unstubAllGlobals();
});

test('a Deep Fact fragment accents that fact and scrolls it into view', async () => {
  const { container } = await openOrigin('#fact-2');

  expect(anchoredItems(container)).toEqual(['second fact']);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.contexts[0]).toBe(
    container.querySelector('[data-anchored]'),
  );
  expect(scrollIntoView).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'smooth' }),
  );
});

test('a Key Moment fragment accents that moment', async () => {
  const { container } = await openOrigin('#moment-1');

  expect(anchoredItems(container)).toHaveLength(1);
  expect(anchoredItems(container)[0]).toContain('first moment');
});

test('scrolls instantly under prefers-reduced-motion', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  await openOrigin('#fact-1');

  expect(scrollIntoView).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'instant' }),
  );
});

test.each(['#fact-3', '#moment-0', '#quote-1', '#fact-'])(
  'ignores the fragment %s and opens the panel normally',
  async (hash) => {
    const { container } = await openOrigin(hash);

    expect(anchoredItems(container)).toEqual([]);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(panelText(container)).toContain('first fact');
  },
);

test('opening another entity drops the fragment and the accent, and Back restores both', async () => {
  const { container, rtl } = await openOrigin('#fact-2');
  expect(window.location.hash).toBe('#fact-2');

  const connection = Array.from(
    container.querySelectorAll('aside:not([inert]) button'),
  ).find((button) => button.textContent?.includes('why other'));
  await act(async () => {
    rtl.fireEvent.click(connection as Element);
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of other'),
  );
  expect(window.location.search).toBe('?e=slug-of-other');
  expect(window.location.hash).toBe('');
  expect(anchoredItems(container)).toEqual([]);

  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of origin'),
  );
  expect(window.location.hash).toBe('#fact-2');
  await waitFor(() =>
    expect(anchoredItems(container)).toEqual(['second fact']),
  );
});

test('closing the panel drops the fragment', async () => {
  const { container, rtl } = await openOrigin('#fact-2');

  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector('button[aria-label="Close"]') as Element,
    );
  });

  expect(window.location.hash).toBe('');
  expect(window.location.search).toBe('');
});
