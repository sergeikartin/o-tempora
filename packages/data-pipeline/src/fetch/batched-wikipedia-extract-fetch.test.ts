import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { batchedWikipediaExtractFetch, cleanExtract } from "./batched-wikipedia-extract-fetch.js";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

// Same flush pattern commons-client.test.ts/pageviews-client.test.ts use for
// their own retry chains — a mocked setTimeout only fires once it's been
// scheduled, and scheduling happens inside a microtask continuation after
// each await, so a bare tick() can't cascade through a multi-step async
// sequence (a retry chain, or here, the pacing delay between entries).
async function flush(t: TestContext, rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60_000);
  }
}

test("cleanExtract returns the trimmed extract for a standard article", () => {
  assert.equal(cleanExtract({ type: "standard", extract: "  French mathematician.  " }), "French mathematician.");
});

test("cleanExtract strips stray control/format characters a plain trim wouldn't catch", () => {
  // U+200E (left-to-right mark) embedded mid-string, not just at the edges.
  const withMark = "Born‎ 1815, English mathematician.";
  assert.equal(cleanExtract({ type: "standard", extract: withMark }), "Born 1815, English mathematician.");
});

test("cleanExtract treats a disambiguation page as no extract available", () => {
  assert.equal(cleanExtract({ type: "disambiguation", extract: "Mercury may refer to:" }), undefined);
});

test("cleanExtract treats a missing/empty/whitespace-only extract as absent", () => {
  assert.equal(cleanExtract({ type: "standard" }), undefined);
  assert.equal(cleanExtract({ type: "standard", extract: "" }), undefined);
  assert.equal(cleanExtract({ type: "standard", extract: "   ‎  " }), undefined);
});

test("cleanExtract treats an unresolved (undefined) summary as absent", () => {
  assert.equal(cleanExtract(undefined), undefined);
});

test("batchedWikipediaExtractFetch resolves an extract per entity id, keyed by id not title", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    requested.push(url.toString());
    return jsonResponse({ type: "standard", extract: "An extract." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = batchedWikipediaExtractFetch([
    { id: "Q1", title: "Ada_Lovelace" },
    { id: "Q2", title: "Alan_Turing" },
  ]);
  await flush(t);
  const result = await promise;

  assert.equal(result.get("Q1"), "An extract.");
  assert.equal(result.get("Q2"), "An extract.");
  assert.equal(requested.length, 2);
});

test("batchedWikipediaExtractFetch dedupes a title shared by more than one id, fetching it once", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ type: "standard", extract: "Shared." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = batchedWikipediaExtractFetch([
    { id: "id-a", title: "Same_Title" },
    { id: "id-b", title: "Same_Title" },
  ]);
  await flush(t);
  const result = await promise;

  assert.equal(calls, 1);
  assert.equal(result.get("id-a"), "Shared.");
  assert.equal(result.get("id-b"), "Shared.");
});

test("batchedWikipediaExtractFetch skips an entry whose fetch throws, without aborting the rest", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.fetch = (async (url: string | URL) => {
    if (url.toString().includes("Broken")) {
      return jsonResponse("server error", 500);
    }
    return jsonResponse({ type: "standard", extract: "Fine." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  });

  const promise = batchedWikipediaExtractFetch([
    { id: "broken-id", title: "Broken_Title" },
    { id: "fine-id", title: "Fine_Title" },
  ]);
  // The broken entry exhausts its own retry/backoff loop (3 retries,
  // exponential) before the pacing delay to the next entry even starts.
  await flush(t, 20);
  const result = await promise;

  assert.equal(result.has("broken-id"), false);
  assert.equal(result.get("fine-id"), "Fine.");
});

test("batchedWikipediaExtractFetch omits an id whose title resolves to a disambiguation page", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse({ type: "disambiguation", extract: "Mercury may refer to:" }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = batchedWikipediaExtractFetch([{ id: "Q308", title: "Mercury" }]);
  await flush(t);
  const result = await promise;

  assert.equal(result.has("Q308"), false);
});
