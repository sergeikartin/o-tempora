import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fsPromises from "node:fs/promises";
import { fetchPageviews } from "./fetch-pageviews.js";

// Same mocking seam fetch-image-attribution.test.ts uses: fetchPageviews
// reads fixed raw files off disk and hits the real Pageviews API with no
// injectable data source.
function stubReads(t: TestContext, filesByBasename: Record<string, unknown>): void {
  t.mock.method(fsPromises, "readFile", async (filePath: string) => {
    const basename = path.basename(filePath);
    if (basename in filesByBasename) return JSON.stringify(filesByBasename[basename]);
    throw new Error(`stubReads: no fixture registered for ${basename} — lane-scoping should not have read it`);
  });
}

function stubWrites(t: TestContext): Map<string, unknown> {
  const written = new Map<string, unknown>();
  t.mock.method(fsPromises, "writeFile", async (filePath: string, content: string) => {
    written.set(path.basename(filePath), JSON.parse(content));
  });
  return written;
}

function stubPageviewsFetch(t: TestContext, views: number): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [{ views }] }), { status: 200 })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test("fetchPageviews(\"discoveries\") writes only discoveries-pageviews.raw.json, leaving wars' untouched", async (t) => {
  stubReads(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          articleUrls: { en: "https://en.wikipedia.org/wiki/Penicillin" },
          countries: [],
        },
      ],
    },
  });
  const written = stubWrites(t);
  stubPageviewsFetch(t, 42);

  await fetchPageviews("discoveries");

  assert.deepEqual([...written.keys()], ["discoveries-pageviews.raw.json"]);
  assert.deepEqual(written.get("discoveries-pageviews.raw.json"), { Q5: 42 });
});

test("fetchPageviews() with no lane writes both wars and discoveries files", async (t) => {
  stubReads(t, {
    "wars-curated-enriched.raw.json": { wars: [] },
    "events-curated-enriched.raw.json": { events: [] },
  });
  const written = stubWrites(t);
  stubPageviewsFetch(t, 0);

  await fetchPageviews();

  assert.deepEqual(new Set(written.keys()), new Set(["wars-pageviews.raw.json", "discoveries-pageviews.raw.json"]));
});
