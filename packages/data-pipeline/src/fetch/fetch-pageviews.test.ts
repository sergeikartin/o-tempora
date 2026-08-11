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

test("fetchPageviews(\"milestones\") writes only milestones-pageviews.raw.json, leaving conflicts' untouched", async (t) => {
  stubReads(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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

  await fetchPageviews("milestones");

  assert.deepEqual([...written.keys()], ["milestones-pageviews.raw.json"]);
  assert.deepEqual(written.get("milestones-pageviews.raw.json"), { Q5: 42 });
});

test("fetchPageviews() with no lane writes both conflicts and milestones files", async (t) => {
  stubReads(t, {
    "conflicts-curated-enriched.raw.json": { conflicts: [] },
    "milestones-curated-enriched.raw.json": { milestones: [] },
  });
  const written = stubWrites(t);
  stubPageviewsFetch(t, 0);

  await fetchPageviews();

  assert.deepEqual(new Set(written.keys()), new Set(["conflicts-pageviews.raw.json", "milestones-pageviews.raw.json"]));
});
