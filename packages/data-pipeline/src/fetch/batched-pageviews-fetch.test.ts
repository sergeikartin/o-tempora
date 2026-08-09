import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractWikipediaArticleTitle,
  trailingFourYearWindow,
  batchedPageviewsFetch,
} from "./batched-pageviews-fetch.js";

test("extractWikipediaArticleTitle recovers an underscore-joined title from a Wikipedia article URL", () => {
  const title = extractWikipediaArticleTitle("https://en.wikipedia.org/wiki/World_War_II");
  assert.equal(title, "World_War_II");
});

test("extractWikipediaArticleTitle decodes percent-encoded characters in the title", () => {
  const title = extractWikipediaArticleTitle("https://fr.wikipedia.org/wiki/Jacques-Louis%20David");
  assert.equal(title, "Jacques-Louis David");
});

test("extractWikipediaArticleTitle returns undefined for an unparseable URL", () => {
  assert.equal(extractWikipediaArticleTitle("not a url"), undefined);
});

test("trailingFourYearWindow excludes the current partial year, covering the 4 most recently completed calendar years", () => {
  const window = trailingFourYearWindow(new Date(Date.UTC(2026, 7, 9)));
  assert.equal(window.startYYYYMM01, "20220101");
  assert.equal(window.endYYYYMM01, "20251201");
});

test("batchedPageviewsFetch sums pageviews across every resolved language for an entity", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const isEnglish = url.toString().includes("/en.wikipedia/");
    return new Response(JSON.stringify({ items: [{ views: isEnglish ? 100 : 20 }] }), { status: 200 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedPageviewsFetch(
    [{ id: "Q1", articleUrls: { en: "https://en.wikipedia.org/wiki/X", fr: "https://fr.wikipedia.org/wiki/X" } }],
    { startYYYYMM01: "20220101", endYYYYMM01: "20251201" },
  );

  assert.equal(result.get("Q1"), 120);
});

test("batchedPageviewsFetch skips languages with no resolved article URL, contributing nothing for them", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ items: [{ views: 50 }] }), { status: 200 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedPageviewsFetch([{ id: "Q1", articleUrls: { en: "https://en.wikipedia.org/wiki/X" } }], {
    startYYYYMM01: "20220101",
    endYYYYMM01: "20251201",
  });

  assert.equal(calls, 1);
  assert.equal(result.get("Q1"), 50);
});

test("batchedPageviewsFetch treats a failed individual call as 0 rather than failing the whole batch (best-effort, per ADR 0010)", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    if (url.toString().includes("/en.wikipedia/")) throw new Error("network error");
    return new Response(JSON.stringify({ items: [{ views: 30 }] }), { status: 200 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedPageviewsFetch(
    [{ id: "Q1", articleUrls: { en: "https://en.wikipedia.org/wiki/X", fr: "https://fr.wikipedia.org/wiki/X" } }],
    { startYYYYMM01: "20220101", endYYYYMM01: "20251201" },
  );

  assert.equal(result.get("Q1"), 30);
});

test("batchedPageviewsFetch keys totals by the caller's own entity id, not the resolved title", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [{ views: 10 }] }), { status: 200 })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedPageviewsFetch(
    [
      { id: "Q1", articleUrls: { en: "https://en.wikipedia.org/wiki/A" } },
      { id: "Q2", articleUrls: { en: "https://en.wikipedia.org/wiki/B" } },
    ],
    { startYYYYMM01: "20220101", endYYYYMM01: "20251201" },
  );

  assert.equal(result.get("Q1"), 10);
  assert.equal(result.get("Q2"), 10);
});
