import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fsPromises from "node:fs/promises";
import { fetchWikipediaExtracts } from "./fetch-wikipedia-extracts.js";

// Same mocking seam fetch-image-attribution.test.ts/fetch-pageviews.test.ts
// use: fetchWikipediaExtracts reads fixed raw files off disk and hits the
// real Wikipedia REST summary API with no injectable data source.
function stubReads(t: TestContext, filesByBasename: Record<string, unknown>): void {
  t.mock.method(fsPromises, "readFile", async (filePath: string) => {
    const basename = path.basename(filePath);
    if (basename in filesByBasename) {
      const fixture = filesByBasename[basename];
      // people-pantheon.raw.csv is read as plain CSV text, not JSON.
      return typeof fixture === "string" ? fixture : JSON.stringify(fixture);
    }
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

// Responds with an extract keyed by the requested title's last path
// segment, mirroring wikipedia-client.ts's `{ extract }` summary shape.
function stubWikipediaFetch(t: TestContext, extractByTitle: Record<string, string>): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const title = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    const extract = extractByTitle[title];
    return new Response(JSON.stringify(extract ? { type: "standard", extract } : {}), {
      status: extract ? 200 : 404,
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

const PANTHEON_HEADER =
  '"id","wd_id","wp_id","slug","name","occupation","prob_ratio","gender","twitter","alive","l","hpi_raw","bplace_name","bplace_lat","bplace_lon","bplace_geonameid","bplace_country","birthdate","birthyear","dplace_name","dplace_lat","dplace_lon","dplace_geonameid","dplace_country","deathdate","deathyear","bplace_geacron_name","dplace_geacron_name","is_group","l_","age","non_en_page_views","coefficient_of_variation","hpi"';

test("fetchWikipediaExtracts(\"milestones\") writes only milestones-wikipedia-extracts.raw.json, leaving people/conflicts untouched", async (t) => {
  stubReads(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          articleUrls: {},
          countries: [],
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
        },
      ],
    },
  });
  const written = stubWrites(t);
  stubWikipediaFetch(t, { Penicillin: "An antibiotic." });

  await fetchWikipediaExtracts("milestones");

  assert.deepEqual([...written.keys()], ["milestones-wikipedia-extracts.raw.json"]);
  assert.deepEqual(written.get("milestones-wikipedia-extracts.raw.json"), { Q5: "An antibiotic." });
});

test("fetchWikipediaExtracts() with no lane writes all three lanes' files, pacing every entity in one shared run", async (t) => {
  stubReads(t, {
    "people-pantheon.raw.csv": [PANTHEON_HEADER].join("\n"),
    "conflicts-curated-enriched.raw.json": { conflicts: [] },
    "milestones-curated-enriched.raw.json": { milestones: [] },
  });
  const written = stubWrites(t);
  stubWikipediaFetch(t, {});

  await fetchWikipediaExtracts();

  assert.deepEqual(
    new Set(written.keys()),
    new Set(["people-wikipedia-extracts.raw.json", "conflicts-wikipedia-extracts.raw.json", "milestones-wikipedia-extracts.raw.json"]),
  );
});
