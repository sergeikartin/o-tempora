import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllPages } from "./wikidata-client.js";
import { buildPeopleQuery } from "./queries/people.js";
import type { SparqlResults } from "./sparql-result-shape.js";

const PAGE_SIZE = 500;

// Per-bucket page cap. Lower than the pre-bucketing cap (was 40, for one
// unbounded scan) since the corpus is now split across PEOPLE_ERA_BUCKETS
// instead of one scan — still generous per bucket (offset up to 9,500)
// relative to how many people any single era/sitelinks>20 window plausibly
// contains. Spot-checked live before changing: offset depth up to ~20,000
// stays inside the query service's empirically reliable range regardless of
// bucket (see architecture.md's "pagination has a soft ceiling" decision);
// this just spends that budget across more, narrower windows.
const MAX_PAGES_PER_BUCKET = 20;

// Birth-year buckets ([minYear, maxYearExclusive)), fetched independently so
// every era gets its own page budget regardless of the live service's
// incidental (QID-correlated) internal ordering — see queries/people.ts's
// buildPeopleQuery doc comment for the root cause this works around: an
// unbounded fetch never got past birthYear 401 in a real run, because its
// entire page budget was consumed within antiquity before reaching any
// modern-era row.
//
// Buckets narrow moving toward the present: Wikidata's person density (at
// sitelinks>20) grows enormously from the 19th century on — a wide bucket
// there would just reproduce the original bug at smaller scale, since a
// bucket's own internal pagination order is just as arbitrary as the
// unbucketed scan was.
const PEOPLE_ERA_BUCKETS: ReadonlyArray<readonly [number, number]> = [
  [-4000, -800],
  [-800, -400],
  [-400, 1],
  [1, 400],
  [400, 800],
  [800, 1200],
  [1200, 1500],
  [1500, 1600],
  [1600, 1700],
  [1700, 1750],
  [1750, 1800],
  [1800, 1825],
  [1825, 1850],
  [1850, 1875],
  [1875, 1900],
  [1900, 1910],
  [1910, 1920],
  [1920, 1930],
  [1930, 1940],
  [1940, 1950],
  [1950, 1960],
  [1960, 1970],
  [1970, 1980],
  [1980, 1990],
  [1990, 2000],
  [2000, new Date().getUTCFullYear() + 1],
];

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

export async function fetchPeople(): Promise<void> {
  console.log("Fetching candidate people from the Wikidata Query Service, bucketed by era...");

  let vars: string[] = [];
  const bindings: SparqlResults["results"]["bindings"] = [];

  for (const [minYear, maxYearExclusive] of PEOPLE_ERA_BUCKETS) {
    console.log(`  era ${minYear} to ${maxYearExclusive}:`);
    try {
      const result = await fetchAllPages(
        (limit, offset) => buildPeopleQuery(limit, offset, minYear, maxYearExclusive),
        PAGE_SIZE,
        MAX_PAGES_PER_BUCKET,
      );
      if (result.head.vars.length > 0) vars = result.head.vars;
      bindings.push(...result.results.bindings);
    } catch (error) {
      // A single bucket's first page failing (live service instability,
      // documented throughout this project) shouldn't lose every other
      // bucket already collected — skip it and keep going, same graceful
      // degradation fetchAllPages already applies within a bucket.
      console.warn(`    bucket failed (${(error as Error).message}); skipping.`);
    }
  }

  const combined: SparqlResults = { head: { vars }, results: { bindings } };

  await mkdir(RAW_DIR, { recursive: true });
  const outputPath = path.join(RAW_DIR, "people.raw.json");
  await writeFile(outputPath, JSON.stringify(combined, null, 2));
  console.log(`Wrote ${combined.results.bindings.length} rows to ${outputPath}`);
}
