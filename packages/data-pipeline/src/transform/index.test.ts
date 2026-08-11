import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformPeople, transformWars, transformDiscoveries } from "./index.js";
import { computeFameScore } from "./score.js";

// transformWars/transformDiscoveries read fixed raw files off disk
// (RAW_DIR, derived from this module's own location) with no injectable
// data source — mocking fs.readFileSync per-filename is the seam available
// without widening transform/index.ts's interface just for testability.
function stubRawFiles(t: TestContext, filesByBasename: Record<string, unknown>): void {
  t.mock.method(fs, "readFileSync", (filePath: string, ...rest: unknown[]) => {
    const basename = path.basename(filePath);
    if (basename in filesByBasename) {
      const fixture = filesByBasename[basename];
      // people-pantheon.raw.csv is read as plain CSV text, not JSON — every
      // other fixture here is a raw-file object serialized on read.
      return typeof fixture === "string" ? fixture : JSON.stringify(fixture);
    }
    throw new Error(`stubRawFiles: no fixture registered for ${basename}`);
  });
}

// Same 34-column header pantheon-row-shape.test.ts's own fixture uses —
// transformPeople is the only function here that reads the Pantheon CSV
// directly, via parsePantheonCsv, so it needs a header-complete row rather
// than a partial JSON fixture.
const PANTHEON_HEADER =
  '"id","wd_id","wp_id","slug","name","occupation","prob_ratio","gender","twitter","alive","l","hpi_raw","bplace_name","bplace_lat","bplace_lon","bplace_geonameid","bplace_country","birthdate","birthyear","dplace_name","dplace_lat","dplace_lon","dplace_geonameid","dplace_country","deathdate","deathyear","bplace_geacron_name","dplace_geacron_name","is_group","l_","age","non_en_page_views","coefficient_of_variation","hpi"';

function pantheonRow(overrides: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    id: "14627",
    wd_id: '"Q935"',
    wp_id: "14627",
    slug: '"Isaac_Newton"',
    name: '"Isaac Newton"',
    occupation: '"PHYSICIST"',
    prob_ratio: "0",
    gender: '"M"',
    twitter: "",
    alive: "FALSE",
    l: "235",
    hpi_raw: "99.439201",
    bplace_name: '"Woolsthorpe-by-Colsterworth"',
    bplace_lat: "52.809863",
    bplace_lon: "-0.62877",
    bplace_geonameid: "201088",
    bplace_country: '"United Kingdom"',
    birthdate: '"1643-01-04"',
    birthyear: "1643",
    dplace_name: '"Kensington"',
    dplace_lat: "51.5",
    dplace_lon: "-0.19",
    dplace_geonameid: "54732",
    dplace_country: '"United Kingdom"',
    deathdate: '"1727-03-31"',
    deathyear: "1726",
    bplace_geacron_name: '"woolsthorpe-by-colsterworth"',
    dplace_geacron_name: '"kensington"',
    is_group: "FALSE",
    l_: "30.988774869925628",
    age: "83",
    non_en_page_views: "2508822",
    coefficient_of_variation: "3.7821597382938283",
    hpi: "99.439201",
  };
  const fields = { ...defaults, ...overrides };
  return [
    fields.id,
    fields.wd_id,
    fields.wp_id,
    fields.slug,
    fields.name,
    fields.occupation,
    fields.prob_ratio,
    fields.gender,
    fields.twitter,
    fields.alive,
    fields.l,
    fields.hpi_raw,
    fields.bplace_name,
    fields.bplace_lat,
    fields.bplace_lon,
    fields.bplace_geonameid,
    fields.bplace_country,
    fields.birthdate,
    fields.birthyear,
    fields.dplace_name,
    fields.dplace_lat,
    fields.dplace_lon,
    fields.dplace_geonameid,
    fields.dplace_country,
    fields.deathdate,
    fields.deathyear,
    fields.bplace_geacron_name,
    fields.dplace_geacron_name,
    fields.is_group,
    fields.l_,
    fields.age,
    fields.non_en_page_views,
    fields.coefficient_of_variation,
    fields.hpi,
  ].join(",");
}

function pantheonCsv(...rows: string[]): string {
  return [PANTHEON_HEADER, ...rows].join("\n");
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
    "wars-image-attribution.raw.json": {},
    "wars-pageviews.raw.json": { Q2: 4_000_000 },
    "wars-wikipedia-extracts.raw.json": {},
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
    "wars-image-attribution.raw.json": {},
    "wars-pageviews.raw.json": {},
    "wars-wikipedia-extracts.raw.json": {},
  });

  const [war] = transformWars();

  assert.equal(war?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 0 }));
});

test("transformWars passes through the Wikipedia extract keyed by the war's own id, when present", (t) => {
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
    "wars-image-attribution.raw.json": {},
    "wars-pageviews.raw.json": {},
    "wars-wikipedia-extracts.raw.json": { Q2: "A war fought between Athens and Sparta for dominance of Greece." },
  });

  const [war] = transformWars();

  assert.equal(war?.description, "A war fought between Athens and Sparta for dominance of Greece.");
});

test("transformWars leaves description undefined when no Wikipedia extract resolved for this id", (t) => {
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
    "wars-image-attribution.raw.json": {},
    "wars-pageviews.raw.json": {},
    "wars-wikipedia-extracts.raw.json": {},
  });

  const [war] = transformWars();

  assert.equal(war?.description, undefined);
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
          tagline: "1928 discovery of the antibiotic",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "discoveries-image-attribution.raw.json": {},
    "discoveries-pageviews.raw.json": { Q5: 9_000_000 },
    "discoveries-wikipedia-extracts.raw.json": {},
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 9_000_000 }));
});

test("transformDiscoveries passes through the enrichment file's live-fetched tagline (not any curated fallback)", (t) => {
  stubRawFiles(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          tagline: "1928 discovery of an antibiotic produced by Penicillium mould",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "discoveries-image-attribution.raw.json": {},
    "discoveries-pageviews.raw.json": {},
    "discoveries-wikipedia-extracts.raw.json": {},
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.tagline, "1928 discovery of an antibiotic produced by Penicillium mould");
});

test("transformDiscoveries leaves tagline undefined when the enrichment pass couldn't resolve one (Output drops it, not Transform)", (t) => {
  stubRawFiles(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q6",
          name: "Some Obscure Invention",
          year: 1900,
          category: "science-theory",
          sitelinks: 40,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Some_Obscure_Invention",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "discoveries-image-attribution.raw.json": {},
    "discoveries-pageviews.raw.json": {},
    "discoveries-wikipedia-extracts.raw.json": {},
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.tagline, undefined);
});

test("transformDiscoveries passes through the Wikipedia extract keyed by the event's own id, when present", (t) => {
  stubRawFiles(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          tagline: "1928 discovery of the antibiotic",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "discoveries-image-attribution.raw.json": {},
    "discoveries-pageviews.raw.json": {},
    "discoveries-wikipedia-extracts.raw.json": {
      Q5: "Penicillin is a group of antibiotics derived from Penicillium moulds.",
    },
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.description, "Penicillin is a group of antibiotics derived from Penicillium moulds.");
});

test("transformDiscoveries leaves description undefined when no Wikipedia extract resolved for this id", (t) => {
  stubRawFiles(t, {
    "events-curated-enriched.raw.json": {
      events: [
        {
          id: "Q5",
          name: "Penicillin",
          year: 1928,
          category: "medicine-health",
          tagline: "1928 discovery of the antibiotic",
          sitelinks: 80,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "discoveries-image-attribution.raw.json": {},
    "discoveries-pageviews.raw.json": {},
    "discoveries-wikipedia-extracts.raw.json": {},
  });

  const [discovery] = transformDiscoveries();

  assert.equal(discovery?.description, undefined);
});

test("transformPeople passes through tagline and description, keyed by the person's Wikidata QID (wd_id)", (t) => {
  stubRawFiles(t, {
    "people-pantheon.raw.csv": pantheonCsv(pantheonRow()),
    "people-taglines.raw.json": {
      head: { vars: ["person", "tagline", "image"] },
      results: {
        bindings: [
          {
            person: { type: "uri", value: "http://www.wikidata.org/entity/Q935" },
            tagline: { type: "literal", "xml:lang": "en", value: "English physicist and mathematician" },
          },
        ],
      },
    },
    "people-image-attribution.raw.json": {},
    "people-wikipedia-extracts.raw.json": {
      Q935: "Sir Isaac Newton was an English mathematician, physicist, and astronomer.",
    },
  });

  const [person] = transformPeople();

  assert.equal(person?.tagline, "English physicist and mathematician");
  assert.equal(person?.description, "Sir Isaac Newton was an English mathematician, physicist, and astronomer.");
});

test("transformPeople leaves description undefined when no Wikipedia extract resolved for this person's QID", (t) => {
  stubRawFiles(t, {
    "people-pantheon.raw.csv": pantheonCsv(pantheonRow()),
    "people-taglines.raw.json": {
      head: { vars: ["person", "tagline", "image"] },
      results: {
        bindings: [
          {
            person: { type: "uri", value: "http://www.wikidata.org/entity/Q935" },
            tagline: { type: "literal", "xml:lang": "en", value: "English physicist and mathematician" },
          },
        ],
      },
    },
    "people-image-attribution.raw.json": {},
    "people-wikipedia-extracts.raw.json": {},
  });

  const [person] = transformPeople();

  assert.equal(person?.description, undefined);
});
