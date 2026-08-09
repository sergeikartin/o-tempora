import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { fetchArticlePageviews } from "./pageviews-client.js";

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

// Same flush pattern commons-client.test.ts/wikidata-client.test.ts use —
// a retry chain schedules its next sleep() from inside a microtask
// continuation, so ticking alone can't cascade through multiple retries.
async function flushRetries(t: TestContext, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60_000);
  }
}

test("requests the per-article monthly endpoint with project/article/date-range in the expected shape", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string | URL) => {
    requestedUrl = url.toString();
    return jsonResponse({ items: [{ views: 100 }] }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await fetchArticlePageviews("en.wikipedia", "World_War_II", "20220101", "20251201");

  assert.equal(
    requestedUrl,
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/World_War_II/monthly/20220101/20251201",
  );
});

test("sums views across every returned monthly item", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse({ items: [{ views: 100 }, { views: 250 }, { views: 40 }] }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const total = await fetchArticlePageviews("en.wikipedia", "Penicillin", "20220101", "20251201");

  assert.equal(total, 390);
});

test("treats a 404 (no data for that title/period) as 0, not an error", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ type: "not_found" }, 404);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const total = await fetchArticlePageviews("en.wikipedia", "Some_Obscure_Stub", "20220101", "20251201");

  assert.equal(total, 0);
  assert.equal(calls, 1);
});

test("retries HTTP 502 with exponential backoff, then succeeds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 3 ? jsonResponse({}, 502) : jsonResponse({ items: [{ views: 10 }] }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = fetchArticlePageviews("en.wikipedia", "Internet", "20220101", "20251201");
  await flushRetries(t);
  const total = await promise;

  assert.equal(calls, 3);
  assert.equal(total, 10);
});

test("retries HTTP 429 respecting a retry-after header, then succeeds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 2 ? jsonResponse({}, 429, { "retry-after": "1" }) : jsonResponse({ items: [{ views: 5 }] }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = fetchArticlePageviews("en.wikipedia", "Computer", "20220101", "20251201");
  await flushRetries(t);
  const total = await promise;

  assert.equal(calls, 2);
  assert.equal(total, 5);
});

test("does not retry a non-retryable status like 400", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse("bad request", 400);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(fetchArticlePageviews("en.wikipedia", "X", "20220101", "20251201"), /HTTP 400/);
  assert.equal(calls, 1);
});

test("rejects a response whose items isn't the expected array shape", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse({ items: { notAnArray: true } }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(fetchArticlePageviews("en.wikipedia", "X", "20220101", "20251201"), /expected items shape/);
});
