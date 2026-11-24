import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  qidsByTitle,
  resolveArticleQids,
  titleOfArticleUrl,
} from './wikipedia-qids.js';

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
