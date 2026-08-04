import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { runSparqlQuery } from "./wikidata-client.js";

const EMPTY_RESULT = { head: { vars: [] }, results: { bindings: [] } };

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

// Mocked `setTimeout` only fires timers that already existed at the moment
// `tick()` is called — a retry chain registers its *next* sleep() call from
// inside a microtask continuation after the previous one fires, so a single
// tick() can't cascade through multiple retries. Alternate flushing
// microtasks (letting the mocked fetch + retry logic run forward to the
// point of scheduling its next timer) with ticking, enough rounds to cover
// every retry this suite exercises.
async function flushRetries(t: TestContext, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60_000);
  }
}

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

  const promise = runSparqlQuery("SELECT * WHERE {}");
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 3);
  assert.deepEqual(result, EMPTY_RESULT);
});

test("retries 503 and 504 the same way as 502", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  const statuses = [503, 504, 200];
  let calls = 0;
  globalThis.fetch = (async () => {
    const status = statuses[calls] ?? 200;
    calls++;
    return status === 200 ? jsonResponse(EMPTY_RESULT, 200) : jsonResponse({}, status);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = runSparqlQuery("SELECT * WHERE {}");
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 3);
  assert.deepEqual(result, EMPTY_RESULT);
});

test("gives up on 502 after exhausting retries", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse("server error", 502);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = assert.rejects(runSparqlQuery("SELECT * WHERE {}"), /HTTP 502/);
  await flushRetries(t);
  await promise;

  // Initial attempt + MAX_RETRIES retries.
  assert.equal(calls, 4);
});

test("still retries 429 using Retry-After, unaffected by the new backoff path", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 2 ? jsonResponse({}, 429, { "retry-after": "1" }) : jsonResponse(EMPTY_RESULT, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = runSparqlQuery("SELECT * WHERE {}");
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 2);
  assert.deepEqual(result, EMPTY_RESULT);
});

test("does not retry a non-retryable status like 400", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse("bad query", 400);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(runSparqlQuery("SELECT * WHERE {}"), /HTTP 400/);
  assert.equal(calls, 1);
});
