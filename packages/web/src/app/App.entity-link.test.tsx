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
  return (
    container
      .querySelector(`button[aria-label="${label}"]`)
      ?.getAttribute('aria-pressed') === 'true'
  );
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
  const { container } = await renderApp();

  await waitFor(() =>
    expect(
      container.querySelector('a[href^="/ru/"]')?.getAttribute('href'),
    ).toBe('/ru/timeline/?e=slug-of-mainstream'),
  );
});

test('the language switch has no entity when nothing is open', async () => {
  const { container } = await renderApp();

  expect(container.querySelector('a[href^="/ru/"]')?.getAttribute('href')).toBe(
    '/ru/timeline/',
  );
});

function markOf(container: HTMLElement, id: string) {
  const mark = container.querySelector(`[data-entity-id="${id}"]`);
  expect(mark, `mark of ${id}`).toBeTruthy();
  return mark as Element;
}

function memberNames(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('aside:not([inert]) li p:first-child'),
  ).map((name) => name.textContent);
}

test('an Entity Link with several slugs opens them as one Selection, with bands and the overlap line', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second',
  );
  const { container } = await renderApp();

  await waitFor(() =>
    expect(panelText(container)).toContain('Overlap: 1820 – 1850'),
  );
  expect(memberNames(container)).toEqual(['mainstream', 'second']);
  expect(container.querySelectorAll('[data-span-band]')).toHaveLength(2);
  expect(container.querySelector('[data-overlap-band]')).toBeTruthy();
  expect(window.location.search).toBe('?e=slug-of-mainstream&e=slug-of-second');
});

test('members without a common span say so and draw no Overlap Band', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-fifth',
  );
  const { container } = await renderApp();

  await waitFor(() => expect(panelText(container)).toContain('No shared span'));
  expect(container.querySelectorAll('[data-span-band]')).toHaveLength(2);
  expect(container.querySelector('[data-overlap-band]')).toBeNull();
});

test('a link names at most four entities, extras are ignored', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second&e=slug-of-third&e=slug-of-fourth&e=slug-of-fifth',
  );
  const { container } = await renderApp();

  await waitFor(() => expect(memberNames(container)).toHaveLength(4));
  expect(window.location.search).not.toContain('fifth');
  const add = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Add to comparison',
  );
  expect((add as HTMLButtonElement).disabled).toBe(true);
  expect(container.textContent).toContain('Up to 4');
});

test('a slug no level contains is dropped while the others open', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=no-such-slug&e=slug-of-second',
  );
  const { container } = await renderApp();

  await waitFor(() =>
    expect(memberNames(container)).toEqual(['mainstream', 'second']),
  );
  expect(window.location.search).toBe('?e=slug-of-mainstream&e=slug-of-second');
});

test('Shift-click adds a mark; Back closes the whole Selection in one step', async () => {
  const { container, rtl } = await renderApp();
  const lengthBefore = window.history.length;

  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'mainstream'));
  });
  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'second'), { shiftKey: true });
  });
  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'third'), { shiftKey: true });
  });

  await waitFor(() =>
    expect(memberNames(container)).toEqual(['mainstream', 'second', 'third']),
  );
  expect(window.location.search).toBe(
    '?e=slug-of-mainstream&e=slug-of-second&e=slug-of-third',
  );
  expect(window.history.length).toBe(lengthBefore + 1);

  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(window.location.search).toBe('');
  expect(panelText(container)).not.toContain('Overlap');
});

test('a plain click replaces the Selection without adding history', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second',
  );
  const { container, rtl } = await renderApp();
  await waitFor(() => expect(memberNames(container)).toHaveLength(2));
  const lengthBefore = window.history.length;

  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'third'));
  });

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of third'),
  );
  expect(window.location.search).toBe('?e=slug-of-third');
  expect(window.history.length).toBe(lengthBefore);
});

test('a fifth add is ignored', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second&e=slug-of-third&e=slug-of-fourth',
  );
  const { container, rtl } = await renderApp();
  await waitFor(() => expect(memberNames(container)).toHaveLength(4));

  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'fifth'), { shiftKey: true });
  });

  expect(memberNames(container)).toHaveLength(4);
  expect(window.location.search).not.toContain('fifth');
});

test('the panel button arms an add, so the next plain click adds instead of replacing', async () => {
  window.history.replaceState(null, '', '/?e=slug-of-mainstream');
  const { container, rtl } = await renderApp();
  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of mainstream'),
  );

  const add = Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent === 'Add to comparison',
  ) as HTMLButtonElement;
  await act(async () => {
    rtl.fireEvent.click(add);
  });
  await act(async () => {
    rtl.fireEvent.click(markOf(container, 'second'));
  });

  await waitFor(() =>
    expect(memberNames(container)).toEqual(['mainstream', 'second']),
  );
  expect(window.location.search).toBe('?e=slug-of-mainstream&e=slug-of-second');
});

test('removing a member with × keeps the rest and replaces the history entry', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second',
  );
  const { container, rtl } = await renderApp();
  await waitFor(() => expect(memberNames(container)).toHaveLength(2));
  const lengthBefore = window.history.length;

  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector(
        'button[aria-label="Remove mainstream from comparison"]',
      ) as Element,
    );
  });

  await waitFor(() =>
    expect(panelText(container)).toContain('tagline of second'),
  );
  expect(window.location.search).toBe('?e=slug-of-second');
  expect(window.history.length).toBe(lengthBefore);
});

test('a member the Detail Level hides stays selected, keeps its band and is noted as hidden', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-modest',
  );
  const { container, rtl } = await renderApp();
  await waitFor(() => expect(memberNames(container)).toHaveLength(2));
  expect(panelText(container)).not.toContain('Hidden by filters');

  await act(async () => {
    rtl.fireEvent.click(
      container.querySelector('button[aria-label="Legendary"]') as Element,
    );
  });

  expect(memberNames(container)).toEqual(['mainstream', 'modest']);
  expect(panelText(container)).toContain('Hidden by filters');
  expect(container.querySelectorAll('[data-span-band]')).toHaveLength(2);
  await waitFor(() =>
    expect(container.querySelector('[data-entity-id="modest"]')).toBeNull(),
  );
});

test('the language switch carries every slug of the Selection', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-second',
  );
  const { container } = await renderApp();

  await waitFor(() =>
    expect(
      container.querySelector('a[href^="/ru/"]')?.getAttribute('href'),
    ).toBe('/ru/timeline/?e=slug-of-mainstream&e=slug-of-second'),
  );
});

test('loading stops at the deepest level any slug needs and raises the Detail Level to the least famous', async () => {
  window.history.replaceState(
    null,
    '',
    '/?e=slug-of-mainstream&e=slug-of-level3&e=slug-of-level4',
  );
  const { container } = await renderApp();

  await waitFor(() => expect(memberNames(container)).toHaveLength(3));
  expect(isLevelSelected(container, 'Deep Cut')).toBe(true);
});
