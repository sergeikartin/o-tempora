import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Person } from '../shared/types';
import type { LocaleDatasets } from './locale-datasets';

function person(
  id: string,
  fameScore: number,
  occupationDomain: Person['occupationDomain'] = 'institutions',
): Person {
  return {
    id,
    slug: `slug-of-${id}`,
    name: id,
    lifespan: { start: { year: 1800 }, end: { year: 1850 } },
    occupationDomain,
    regionTags: [],
    fameScore,
    tagline: `tagline of ${id}`,
    wikipediaUrl: `https://en.wikipedia.org/wiki/${id}`,
    hasProfile: true,
  };
}

const empty = { conflicts: [], milestones: [] };
const base: LocaleDatasets = {
  people: [
    person('origin', 95),
    person('shown', 92),
    // Hidden by any Domain filter that excludes 'arts'.
    person('artist', 93, 'arts'),
  ],
  ...empty,
};
const level3: LocaleDatasets = { people: [person('deeper', 86)], ...empty };
const level4: LocaleDatasets = { people: [], ...empty };

const connection = (id: string, detailLevel: 1 | 2 | 3 | 4) => ({
  slug: `slug-of-${id}`,
  name: id,
  reason: `why ${id}`,
  lane: 'people',
  detailLevel,
});

const profiles: Record<string, unknown> = {
  'slug-of-origin': {
    overview: 'overview of origin',
    keyMoments: [],
    deepFacts: [],
    connections: [
      connection('shown', 2),
      connection('artist', 2),
      connection('deeper', 3),
    ],
  },
  'slug-of-shown': {
    overview: 'overview of shown',
    keyMoments: [],
    deepFacts: [],
    connections: [connection('origin', 2)],
  },
  'slug-of-deeper': {
    overview: 'overview of deeper',
    keyMoments: [],
    deepFacts: [],
    connections: [],
  },
};

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
    level3DatasetPromise: Promise.resolve(level3),
    level4DatasetPromise: Promise.resolve(level4),
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

function isLevelSelected(container: HTMLElement, label: string) {
  const trigger = container.querySelector(
    'fieldset[aria-label="Detail Level"] > button',
  );
  return trigger?.textContent?.includes(label) ?? false;
}

function connectionButton(container: HTMLElement, name: string) {
  const button = Array.from(
    container.querySelectorAll('aside:not([inert]) button'),
  ).find((candidate) => candidate.textContent?.includes(`why ${name}`));
  expect(button, `Connection to ${name}`).toBeTruthy();
  return button as Element;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/?e=slug-of-origin');
});

afterEach(() => {
  vi.doUnmock('./locale-datasets');
  vi.unstubAllGlobals();
});

test('opening a Connection pushes a history entry and Back returns to the previous panel', async () => {
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of origin'),
  );
  const lengthBefore = window.history.length;

  await act(async () => {
    rtl.fireEvent.click(connectionButton(container, 'shown'));
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of shown'),
  );
  expect(window.location.search).toBe('?e=slug-of-shown');
  expect(window.history.length).toBe(lengthBefore + 1);

  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of origin'),
  );
  expect(window.location.search).toBe('?e=slug-of-origin');
});

test('a Connection below the current Detail Level is marked, and opening it raises the level', async () => {
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of origin'),
  );
  expect(isLevelSelected(container, 'Mainstream')).toBe(true);
  expect(connectionButton(container, 'deeper').textContent).toContain(
    'Appears at Specialized',
  );
  expect(connectionButton(container, 'shown').textContent).not.toContain(
    'Appears at',
  );

  await act(async () => {
    rtl.fireEvent.click(connectionButton(container, 'deeper'));
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of deeper'),
  );
  expect(isLevelSelected(container, 'Specialized')).toBe(true);
  expect(window.location.search).toBe('?e=slug-of-deeper');
});

test('a Filter that hides a Connection target does not remove it from the list', async () => {
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('overview of origin'),
  );

  await act(async () => {
    rtl.fireEvent.click(
      rtl.within(container).getByRole('button', { name: /^Filters/ }),
    );
  });
  await act(async () => {
    rtl.fireEvent.click(
      rtl.within(container).getByLabelText('Filter by Sports'),
    );
  });
  await waitFor(() =>
    expect(container.querySelector('[data-entity-id="artist"]')).toBeNull(),
  );

  expect(connectionButton(container, 'artist')).toBeTruthy();
  expect(connectionButton(container, 'shown')).toBeTruthy();
});
