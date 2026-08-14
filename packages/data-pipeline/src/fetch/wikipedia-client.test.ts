import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { fetchWikipediaSummary } from "./wikipedia-client.js";

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

// Same flush pattern commons-client.test.ts/pageviews-client.test.ts use —
// a retry chain schedules its next sleep() from inside a microtask
// continuation, so ticking alone can't cascade through multiple retries.
async function flushRetries(t: TestContext, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(60_000);
  }
}

test("URL-encodes the title into the summary endpoint's path segment", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string | URL) => {
    requestedUrl = url.toString();
    return jsonResponse({ type: "standard", extract: "A city in France." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await fetchWikipediaSummary("Saint-Étienne, Loire");

  assert.equal(
    requestedUrl,
    "https://en.wikipedia.org/api/rest_v1/page/summary/Saint-%C3%89tienne%2C%20Loire",
  );
});

test("requests ru.wikipedia.org's summary endpoint when lang is ru", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string | URL) => {
    requestedUrl = url.toString();
    return jsonResponse({ type: "standard", extract: "Город во Франции." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await fetchWikipediaSummary("Сент-Этьен", "ru");

  assert.equal(requestedUrl, "https://ru.wikipedia.org/api/rest_v1/page/summary/%D0%A1%D0%B5%D0%BD%D1%82-%D0%AD%D1%82%D1%8C%D0%B5%D0%BD");
});

test("parses a successful standard-article response", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse({ type: "standard", extract: "French mathematician and physicist." }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await fetchWikipediaSummary("Blaise_Pascal");

  assert.deepEqual(result, { type: "standard", extract: "French mathematician and physicist." });
});

test("treats a 404 (no article resolves for this title) as undefined, not an error", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return jsonResponse({ type: "https://mediawiki.org/wiki/HyperSwitch/errors/not_found" }, 404);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await fetchWikipediaSummary("Some_Nonexistent_Title_Xyz");

  assert.equal(result, undefined);
  assert.equal(calls, 1);
});

test("retries HTTP 502/503/504 with exponential backoff, then succeeds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 3 ? jsonResponse({}, 503) : jsonResponse({ type: "standard", extract: "OK" }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = fetchWikipediaSummary("Retry_Me");
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 3);
  assert.deepEqual(result, { type: "standard", extract: "OK" });
});

test("retries HTTP 429 respecting a retry-after header, then succeeds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls < 2
      ? jsonResponse({}, 429, { "retry-after": "1" })
      : jsonResponse({ type: "standard", extract: "Paced." }, 200);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const promise = fetchWikipediaSummary("Paced_Title");
  await flushRetries(t);
  const result = await promise;

  assert.equal(calls, 2);
  assert.deepEqual(result, { type: "standard", extract: "Paced." });
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

  await assert.rejects(fetchWikipediaSummary("Bad_Title"), /HTTP 400/);
  assert.equal(calls, 1);
});

test("rejects a response whose extract/type aren't the expected string-or-absent shape", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => jsonResponse({ extract: { notAString: true } }, 200)) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(fetchWikipediaSummary("Malformed_Title"), /expected shape/);
});
