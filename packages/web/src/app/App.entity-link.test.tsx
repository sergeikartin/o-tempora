import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Person } from '../shared/types';
import type { LocaleDatasets } from './locale-datasets';

function person(
  id: string,
  fameScore: number,
  name = id,
  lifespan: Person['lifespan'] = { start: { year: 1800 }, end: { year: 1850 } },
): Person {
  return {
    id,
    slug: `slug-of-${id}`,
    name,
    lifespan,
    occupationDomain: 'institutions',
    regionTags: [],
    fameScore,
    tagline: `tagline of ${id}`,
    wikipediaUrl: `https://en.wikipedia.org/wiki/${id}`,
  };
}

const empty = { conflicts: [], milestones: [] };
const base: LocaleDatasets = {
  people: [
    person('mainstream', 95),
    person('second', 92, 'second', {
      start: { year: 1820 },
      end: { year: 1855 },
    }),
    person('third', 93, 'third', {
      start: { year: 1830 },
      end: { year: 1845 },
    }),
    person('fourth', 94, 'fourth', {
      start: { year: 1810 },
      end: { year: 1840 },
    }),
    person('fifth', 96, 'fifth', {
      start: { year: 1760 },
      end: { year: 1790 },
    }),
    person('modest', 89, 'modest', {
      start: { year: 1805 },
      end: { year: 1845 },
    }),
  ],
  ...empty,
};
const level3: LocaleDatasets = { people: [person('level3', 86)], ...empty };
const level4: LocaleDatasets = { people: [person('level4', 81)], ...empty };

// Fresh module graph per test: the real module's level 3/4 promises resolve
// once and stay resolved, which would leak progressive-loading state between
// tests.
async function renderApp() {
  vi.resetModules();
  const requestLevel3Load = vi.fn();
  const requestLevel4Load = vi.fn();
  let resolveLevel3: () => void = () => {};
  let resolveLevel4: () => void = () => {};
  vi.doMock('./locale-datasets', () => ({
    localeDatasetsPromise: Promise.resolve(base),
    level3DatasetPromise: new Promise((resolve) => {
      resolveLevel3 = () => resolve(level3);
    }),
    level4DatasetPromise: new Promise((resolve) => {
      resolveLevel4 = () => resolve(level4);
    }),
    requestLevel3Load: () => {
      requestLevel3Load();
      resolveLevel3();
    },
    requestLevel4Load: () => {
      requestLevel4Load();
      resolveLevel3();
      resolveLevel4();
    },
  }));
  const rtl = await import('@testing-library/react');
  const { App } = await import('./App');
  let view!: ReturnType<typeof rtl.render>;
  await act(async () => {
    view = rtl.render(<App />);
  });
  return { ...view, rtl, requestLevel3Load, requestLevel4Load };
}

function panelText(container: HTMLElement) {
  return (
    Array.from(container.querySelectorAll('aside'))
      .filter((aside) => !aside.hasAttribute('inert'))
      .map((aside) => aside.textContent)
      .join(' ') ?? ''
  );
}

function isLevelSelected(container: HTMLElement, label: string) {
  const trigger = container.querySelector(
    'fieldset[aria-label="Detail Level"] > button',
  );
  return trigger?.textContent?.includes(label) ?? false;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.doUnmock('./locale-datasets');
});

test('opens an entity already loaded at Mainstream without loading deeper levels', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-mainstream');
  const { container, requestLevel3Load } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
  expect(requestLevel3Load).not.toHaveBeenCalled();
  expect(isLevelSelected(container, 'Mainstream')).toBe(true);
});

test('loads level 3 for a slug only found there, raising the level to Specialized but no further', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-level3');
  const { container, requestLevel4Load } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of level3'),
  );
  expect(isLevelSelected(container, 'Specialized')).toBe(true);
  expect(requestLevel4Load).not.toHaveBeenCalled();
});

test('loads level 4 after level 3 for a slug only found there, raising the level to Deep Cut', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-level4');
  const { container, requestLevel3Load, requestLevel4Load } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of level4'),
  );
  expect(requestLevel3Load).toHaveBeenCalled();
  expect(requestLevel4Load).toHaveBeenCalled();
  expect(
    requestLevel3Load.mock.invocationCallOrder[0] ?? Infinity,
  ).toBeLessThan(requestLevel4Load.mock.invocationCallOrder[0] ?? -Infinity);
  expect(isLevelSelected(container, 'Deep Cut')).toBe(true);
});

test('an unknown slug opens the timeline with no panel and drops the slug from the URL', async () => {
  window.history.replaceState(null, '', '/?e=no-such-slug');
  const { container, requestLevel4Load } = await renderApp();

  await waitFor(() => expect(window.location.search).toBe(''));
  expect(requestLevel4Load).toHaveBeenCalled();
  expect(panelText(container)).not.toContain('tagline of');
  expect(isLevelSelected(container, 'Mainstream')).toBe(true);
});

test('selecting an entity pushes an entry, Back closes the panel and forward reopens it', async () => {
  const { container, rtl } = await renderApp();
  const lengthBefore = window.history.length;

  const mark = container.querySelector('[data-entity-id="mainstream"]');
  expect(mark).toBeTruthy();
  await act(async () => {
    rtl.fireEvent.click(mark as Element);
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
  expect(window.location.search).toBe('?e=slug-of-mainstream');
  expect(window.history.length).toBe(lengthBefore + 1);

  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(window.location.search).toBe('');
  expect(panelText(container)).not.toContain('tagline of');

  await act(async () => {
    window.history.forward();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
});

test('closing the panel replaces the entry instead of adding one', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-mainstream');
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
  const lengthBefore = window.history.length;

  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector('button[aria-label="Close"]') as Element,
    );
  });

  expect(window.location.search).toBe('');
  expect(window.history.length).toBe(lengthBefore);
});

test('the language switch carries the open entity to the sibling locale', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-mainstream');
  const { container, rtl } = await renderApp();
  await openHelp(container, rtl);

  await waitFor(() =>
    expect(languageHref(container)).toBe('/ru/timeline/?e=slug-of-mainstream'),
  );
});

test('the language switch has no entity when nothing is open', async () => {
  const { container, rtl } = await renderApp();
  await openHelp(container, rtl);

  await waitFor(() => expect(languageHref(container)).toBe('/ru/timeline/'));
});

async function openHelp(
  container: HTMLElement,
  rtl: typeof import('@testing-library/react'),
) {
  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector('button[aria-label="Help"]') as Element,
    );
  });
}

function languageHref(container: HTMLElement) {
  return container.querySelector('a[href^="/ru/"]')?.getAttribute('href');
}

function markOf(container: HTMLElement, id: string) {
  const mark = container.querySelector(`[data-entity-id="${id}"]`);
  expect(mark, `mark of ${id}`).toBeTruthy();
  return mark as Element;
}

test('a link naming several entities opens only the first and rewrites the URL to it', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second',
  );
  const { container } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
  expect(panelText(container)).not.toContain('tagline of second');
  expect(window.location.search).toBe('?e=slug-of-mainstream');
});

test('the Selection draws no Span or Overlap Band and offers no comparison', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-mainstream');
  const { container } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );
  expect(container.querySelector('[data-span-band]')).toBeNull();
  expect(container.querySelector('[data-overlap-band]')).toBeNull();
  expect(container.textContent).not.toContain('Add to comparison');
});

test.each([[{}], [{ shiftKey: true }]])(
  'a click (%o) replaces the Selection without adding history',
  async (modifiers) => {
    window.history.replaceState(null, '', '/?e=slug-of-mainstream');
    const { container, rtl } = await renderApp();
    await waitFor(() =>
      expect(panelText(container)).toContain('tagline of mainstream'),
    );
    const lengthBefore = window.history.length;

    await act(async () => {
      rtl.fireEvent.click(markOf(container, 'third'), modifiers);
    });

    await waitFor(() =>
      expect(panelText(container)).toContain('tagline of third'),
    );
    expect(panelText(container)).not.toContain('tagline of mainstream');
    expect(window.location.search).toBe('?e=slug-of-third');
    expect(window.history.length).toBe(lengthBefore);
  },
);

test('an entity the Detail Level hides stays selected and is noted as hidden', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-modest');
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of modest'),
  );
  expect(panelText(container)).not.toContain('Hidden by filters');

  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector(
        'fieldset[aria-label="Detail Level"] > button',
      ) as Element,
    );
  });
  await act(async () => {
    rtl.fireEvent.click(
      rtl.within(container).getByRole('button', { name: /^Legendary/ }),
    );
  });

  expect(panelText(container)).toContain('tagline of modest');
  expect(panelText(container)).toContain('Hidden by filters');
  await waitFor(() =>
    expect(container.querySelector('[data-entity-id="modest"]')).toBeNull(),
  );
});
