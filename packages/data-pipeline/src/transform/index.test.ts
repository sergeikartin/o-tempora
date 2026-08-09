import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformWars, transformDiscoveries } from "./index.js";
import { computeFameScore } from "./score.js";

// transformWars/transformDiscoveries read fixed raw files off disk
// (RAW_DIR, derived from this module's own location) with no injectable
// data source — mocking fs.readFileSync per-filename is the seam available
// without widening transform/index.ts's interface just for testability.
function stubRawFiles(t: TestContext, filesByBasename: Record<string, unknown>): void {
  t.mock.method(fs, "readFileSync", (filePath: string, ...rest: unknown[]) => {
    const basename = path.basename(filePath);
    if (basename in filesByBasename) return JSON.stringify(filesByBasename[basename]);
    throw new Error(`stubRawFiles: no fixture registered for ${basename}`);
  });
}

test("transformWars computes fameScore via the blend function from the row's sitelinks and the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "wars-curated-enriched.raw.json": {
      wars: [
        {
          id: "Q2",
          name: "Peloponnesian War",
          category: "war",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Peloponnesian_War",
          articleUrls: {},
          countries: [],
          year: -431,
          endYear: -404,
        },
      ],
    },
    "image-attribution.raw.json": { people: {}, discoveries: {}, wars: {} },
    "pageviews.raw.json": { wars: { Q2: 4_000_000 }, discoveries: {} },
  });

  const [war] = transformWars();

  assert.equal(war?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 4_000_000 }));
});

test("transformWars degrades to a sitelinks-only score when the id is absent from the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "wars-curated-enriched.raw.json": {
      wars: [
        {
          id: "Q2",
          name: "Peloponnesian War",
          category: "war",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Peloponnesian_War",
          articleUrls: {},
          countries: [],
          year: -431,
          endYear: -404,
        },
      ],
    },
    "image-attribution.raw.json": { people: {}, discoveries: {}, wars: {} },
    "pageviews.raw.json": { wars: {}, discoveries: {} },
  });

  const [war] = transformWars();

  assert.equal(war?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 0 }));
});

test("transformDiscoveries computes fameScore via the blend function from the row's sitelinks and the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          description: "1928 discovery of the antibiotic",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "image-attribution.raw.json": { people: {}, discoveries: {}, wars: {} },
    "pageviews.raw.json": { wars: {}, discoveries: { Q5: 9_000_000 } },
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 9_000_000 }));
});
