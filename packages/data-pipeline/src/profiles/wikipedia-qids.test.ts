import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  cachedArticleQidResolver,
  qidsByTitle,
  resolveArticleQids,
  titleOfArticleUrl,
} from './wikipedia-qids.ts';

test('titleOfArticleUrl reads plain article links only', () => {
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Isaac_Newton'),
    'Isaac Newton',
  );
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Ren%C3%A9_Descartes'),
    'René Descartes',
  );
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Armada#Defeat'),
    undefined,
  );
  assert.equal(titleOfArticleUrl('https://ru.wikipedia.org/wiki/X'), undefined);
});

test('qidsByTitle follows normalization and redirects to the page item', () => {
  const found = qidsByTitle(['isaac Newton', 'Sir Isaac Newton', 'Nowhere'], {
    query: {
      normalized: [{ from: 'isaac Newton', to: 'Isaac Newton' }],
      redirects: [{ from: 'Sir Isaac Newton', to: 'Isaac Newton' }],
      pages: {
        '1': { title: 'Isaac Newton', pageprops: { wikibase_item: 'Q935' } },
        '-1': { title: 'Nowhere' },
      },
    },
  });
  assert.deepEqual(
    [...found],
    [
      ['isaac Newton', 'Q935'],
      ['Sir Isaac Newton', 'Q935'],
    ],
  );
});

const url = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const success = () =>
  Response.json({
    query: {
      pages: {
        '1': { title: 'Isaac Newton', pageprops: { wikibase_item: 'Q935' } },
      },
    },
  });

test('QID resolution retries throttling and service failures with capped Retry-After and backoff', async () => {
  for (const [responses, expected] of [
    [
      [
        new Response(null, { status: 429, headers: { 'Retry-After': '2' } }),
        new Response(null, { status: 503, headers: { 'Retry-After': '120' } }),
      ],
      [2_000, 60_000],
    ],
    [
      [
        new Response(null, { status: 503 }),
        new Response(null, { status: 502 }),
      ],
      [5_000, 10_000],
    ],
    [[new TypeError('network unavailable')], [5_000]],
  ] as const) {
    const remaining = [...responses];
    const delays: number[] = [];
    const result = await resolveArticleQids([url], {
      fetch: async () => {
        const response = remaining.shift();
        if (response instanceof Error) throw response;
        return response ?? success();
      },
      wait: async (ms) => {
        delays.push(ms);
      },
    });
    assert.deepEqual([...result], [[url, 'Q935']]);
    assert.deepEqual(delays, expected);
  }
});

test('QID resolution caps attempts and fails immediately on permanent HTTP errors', async () => {
  for (const [status, attempts] of [
    [500, 3],
    [404, 1],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      resolveArticleQids([url], {
        fetch: async () => {
          calls++;
          return new Response(null, { status });
        },
        wait: async () => {},
      }),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(calls, attempts);
  }
});

test('cachedArticleQidResolver reuses cached QIDs and fetches only uncached or expired titles', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'qid-cache-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let clock = 1_000;
  const calls: string[][] = [];
  const resolve = cachedArticleQidResolver(
    dir,
    async (urls) => {
      calls.push([...urls]);
      const map = new Map<string, string>();
      for (const item of urls) {
        if (item.includes('Isaac_Newton')) map.set(item, 'Q935');
        if (item.includes('Julius_Caesar')) map.set(item, 'Q1048');
      }
      return map;
    },
    { ttlMs: 10_000, now: () => clock },
  );

  const newton = 'https://en.wikipedia.org/wiki/Isaac_Newton';
  const newtonSpace = 'https://en.wikipedia.org/wiki/Isaac%20Newton';
  const caesar = 'https://en.wikipedia.org/wiki/Julius_Caesar';

  assert.deepEqual([...(await resolve([newton]))], [[newton, 'Q935']]);
  assert.deepEqual(calls, [[newton]]);

  // Same canonical title hits cache without another network call.
  assert.deepEqual(
    [...(await resolve([newtonSpace]))],
    [[newtonSpace, 'Q935']],
  );
  assert.equal(calls.length, 1);

  // Mixed hit + miss fetches only the uncached URL.
  assert.deepEqual(
    [...(await resolve([newton, caesar]))],
    [
      [newton, 'Q935'],
      [caesar, 'Q1048'],
    ],
  );
  assert.deepEqual(calls[1], [caesar]);

  // Expired entry re-fetches.
  clock += 10_001;
  assert.deepEqual([...(await resolve([newton]))], [[newton, 'Q935']]);
  assert.deepEqual(calls[2], [newton]);
});
