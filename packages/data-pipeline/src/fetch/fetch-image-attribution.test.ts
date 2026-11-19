import assert from 'node:assert/strict';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import { fetchImageAttribution } from './fetch-image-attribution.js';

function stubReads(
  t: TestContext,
  filesByBasename: Record<string, unknown>,
): void {
  t.mock.method(fsPromises, 'readFile', async (filePath: string) => {
    const basename = path.basename(filePath);
    if (basename in filesByBasename)
      return JSON.stringify(filesByBasename[basename]);
    throw new Error(
      `stubReads: no fixture registered for ${basename} — lane-scoping should not have read it`,
    );
  });
}

function stubWrites(t: TestContext): Map<string, unknown> {
  const written = new Map<string, unknown>();
  t.mock.method(
    fsPromises,
    'writeFile',
    async (filePath: string, content: string) => {
      written.set(path.basename(filePath), JSON.parse(content));
    },
  );
  return written;
}

function stubCommonsFetch(
  t: TestContext,
  artistByTitle: Record<string, string>,
): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const titles = new URL(url).searchParams.get('titles')?.split('|') ?? [];
    const pages = titles.map((title) => {
      const artist = artistByTitle[title];
      return {
        title,
        imageinfo: [
          artist
            ? {
                extmetadata: {
                  AttributionRequired: { value: 'true' },
                  Artist: { value: artist },
                },
              }
            : { extmetadata: { AttributionRequired: { value: 'false' } } },
        ],
      };
    });
    return new Response(JSON.stringify({ query: { pages } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test('fetchImageAttribution("conflicts") writes only conflicts-image-attribution.raw.json, leaving people/milestones untouched', async (t) => {
  stubReads(t, {
    'conflicts-curated-enriched.raw.json': {
      conflicts: [
        {
          id: 'Q2',
          name: 'Peloponnesian War',
          category: 'war',
          articleUrls: {},
          countries: [],
          image: 'http://commons.wikimedia.org/wiki/Special:FilePath/War.jpg',
        },
      ],
    },
  });
  const written = stubWrites(t);
  stubCommonsFetch(t, { 'File:War.jpg': 'Jane Doe' });

  await fetchImageAttribution('conflicts');

  assert.deepEqual(
    [...written.keys()],
    ['conflicts-image-attribution.raw.json'],
  );
  assert.deepEqual(written.get('conflicts-image-attribution.raw.json'), {
    Q2: 'Jane Doe, via Wikimedia Commons',
  });
});

test("fetchImageAttribution() with no lane writes all three lanes' files", async (t) => {
  stubReads(t, {
    'people-taglines.raw.json': {
      head: { vars: ['person', 'tagline', 'image'] },
      results: {
        bindings: [
          {
            person: {
              type: 'uri',
              value: 'http://www.wikidata.org/entity/Q935',
            },
            image: {
              type: 'uri',
              value:
                'http://commons.wikimedia.org/wiki/Special:FilePath/Newton.jpg',
            },
          },
        ],
      },
    },
    'conflicts-curated-enriched.raw.json': { conflicts: [] },
    'milestones-curated-enriched.raw.json': { milestones: [] },
  });
  const written = stubWrites(t);
  stubCommonsFetch(t, {});

  await fetchImageAttribution();

  assert.deepEqual(
    new Set(written.keys()),
    new Set([
      'people-image-attribution.raw.json',
      'conflicts-image-attribution.raw.json',
      'milestones-image-attribution.raw.json',
    ]),
  );
});
