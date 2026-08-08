import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { fetchCommonsImageInfo } from "./commons-client.js";

const EMPTY_RESULT = { query: { pages: [] } };

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

// Same flush pattern wikidata-client.test.ts uses — a retry chain schedules
// its next sleep() from inside a microtask continuation, so ticking alone
// can't cascade through multiple retries.
async function flushRetries(t: TestContext, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60_000);
  }
}

test("sends titles= and iiprop=extmetadata, and parses a successful response", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string | URL) => {
    requestedUrl = url.toString();
    return jsonResponse(
      { query: { pages: [{ title: "File:A.jpg", imageinfo: [{ extmetadata: {} }] }] } },
      200,
    );
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await fetchCommonsImageInfo(["File:A.jpg", "File:B.jpg"]);

  assert.match(requestedUrl, /titles=File%3AA\.jpg%7CFile%3AB\.jpg/);
  assert.match(requestedUrl, /iiprop=extmetadata/);
  assert.equal(result.query?.pages?.[0]?.title, "File:A.jpg");
});

test("retries HTTP 502 with exponential backoff, then succeeds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 3 ? jsonResponse({}, 502) : jsonResponse(EMPTY_RESULT, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = fetchCommonsImageInfo(["File:A.jpg"]);
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 3);
  assert.deepEqual(result, EMPTY_RESULT);
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

  await assert.rejects(fetchCommonsImageInfo(["File:A.jpg"]), /HTTP 400/);
  assert.equal(calls, 1);
});

test("rejects a response whose query.pages isn't the expected array shape", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse({ query: { pages: { notAnArray: true } } }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(fetchCommonsImageInfo(["File:A.jpg"]), /expected query\.pages shape/);
});
