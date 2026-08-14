import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformPeople, transformConflicts, transformMilestones } from "./index.js";
import { computeFameScore } from "./score.js";

// transformConflicts/transformMilestones read fixed raw files off disk
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

test("transformConflicts computes fameScore via the blend function from the row's sitelinks and the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": { Q2: 4_000_000 },
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 4_000_000 }));
});

test("transformConflicts degrades to a sitelinks-only score when the id is absent from the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 0 }));
});

test("transformConflicts passes through the Wikipedia extract keyed by the conflict's own id, when present", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": { Q2: "A war fought between Athens and Sparta for dominance of Greece." },
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.description, "A war fought between Athens and Sparta for dominance of Greece.");
});

test("transformConflicts leaves description undefined when no Wikipedia extract resolved for this id", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.description, undefined);
});

test("transformConflicts passes through descriptionRu keyed by the conflict's own id, when the Russian Wikipedia extract pass resolved one", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": { Q2: "Война между Афинами и Спартой." },
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.descriptionRu, "Война между Афинами и Спартой.");
});

test("transformConflicts passes through nameRu/taglineRu when the enrichment file resolved them", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
        {
          id: "Q6534",
          name: "French Revolution",
          nameRu: "Великая французская революция",
          category: "revolution",
          sitelinks: 193,
          wikipediaUrl: "https://en.wikipedia.org/wiki/French_Revolution",
          articleUrls: {},
          countries: [],
          tagline: "period of political and societal change in France",
          taglineRu: "период политических и социальных потрясений во Франции",
          year: 1789,
          endYear: 1799,
        },
      ],
    },
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.labelRu, "Великая французская революция");
  assert.equal(conflict?.taglineRu, "период политических и социальных потрясений во Франции");
});

test("transformConflicts leaves labelRu/taglineRu undefined when the enrichment pass didn't resolve a Russian value", (t) => {
  stubRawFiles(t, {
    "conflicts-curated-enriched.raw.json": {
      conflicts: [
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
    "conflicts-image-attribution.raw.json": {},
    "conflicts-pageviews.raw.json": {},
    "conflicts-wikipedia-extracts.raw.json": {},
    "conflicts-wikipedia-extracts.ru.raw.json": {},
  });

  const [conflict] = transformConflicts();

  assert.equal(conflict?.labelRu, undefined);
  assert.equal(conflict?.taglineRu, undefined);
});

test("transformMilestones passes through nameRu/taglineRu when the enrichment file resolved them", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
        {
          id: "Q988780",
          name: "Electromagnetic induction",
          nameRu: "Электромагнитная индукция",
          year: 1831,
          category: "science-theory",
          tagline: "production of voltage by a varying magnetic field",
          taglineRu: "возникновение электрического тока в замкнутом контуре",
          sitelinks: 81,
          wikipediaUrl: "https://en.wikipedia.org/wiki/Electromagnetic_induction",
          articleUrls: {},
          countries: [],
        },
      ],
    },
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": {},
    "milestones-wikipedia-extracts.raw.json": {},
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.labelRu, "Электромагнитная индукция");
  assert.equal(milestone?.taglineRu, "возникновение электрического тока в замкнутом контуре");
});

test("transformMilestones computes fameScore via the blend function from the row's sitelinks and the pageviews raw file", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": { Q5: 9_000_000 },
    "milestones-wikipedia-extracts.raw.json": {},
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.fameScore, computeFameScore({ sitelinks: 80, pageviews: 9_000_000 }));
});

test("transformMilestones passes through the enrichment file's live-fetched tagline (not any curated fallback)", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": {},
    "milestones-wikipedia-extracts.raw.json": {},
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.tagline, "1928 discovery of an antibiotic produced by Penicillium mould");
});

test("transformMilestones leaves tagline undefined when the enrichment pass couldn't resolve one (Output drops it, not Transform)", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": {},
    "milestones-wikipedia-extracts.raw.json": {},
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.tagline, undefined);
});

test("transformMilestones passes through the Wikipedia extract keyed by the milestone's own id, when present", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": {},
    "milestones-wikipedia-extracts.raw.json": {
      Q5: "Penicillin is a group of antibiotics derived from Penicillium moulds.",
    },
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.description, "Penicillin is a group of antibiotics derived from Penicillium moulds.");
});

test("transformMilestones leaves description undefined when no Wikipedia extract resolved for this id", (t) => {
  stubRawFiles(t, {
    "milestones-curated-enriched.raw.json": {
      milestones: [
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
    "milestones-image-attribution.raw.json": {},
    "milestones-pageviews.raw.json": {},
    "milestones-wikipedia-extracts.raw.json": {},
    "milestones-wikipedia-extracts.ru.raw.json": {},
  });

  const [milestone] = transformMilestones();

  assert.equal(milestone?.description, undefined);
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
    "people-wikipedia-extracts.ru.raw.json": {},
  });

  const [person] = transformPeople();

  assert.equal(person?.tagline, "English physicist and mathematician");
  assert.equal(person?.description, "Sir Isaac Newton was an English mathematician, physicist, and astronomer.");
});

test("transformPeople sources name/nameRu from the Wikidata label enrichment, not Pantheon's own CSV name column", (t) => {
  stubRawFiles(t, {
    "people-pantheon.raw.csv": pantheonCsv(pantheonRow({ name: '"Isaac Newton (Pantheon snapshot)"' })),
    "people-taglines.raw.json": {
      head: { vars: ["person", "nameEn", "nameRu", "tagline", "taglineRu", "image"] },
      results: {
        bindings: [
          {
            person: { type: "uri", value: "http://www.wikidata.org/entity/Q935" },
            nameEn: { type: "literal", "xml:lang": "en", value: "Isaac Newton" },
            nameRu: { type: "literal", "xml:lang": "ru", value: "Исаак Ньютон" },
            tagline: { type: "literal", "xml:lang": "en", value: "English physicist and mathematician" },
          },
        ],
      },
    },
    "people-image-attribution.raw.json": {},
    "people-wikipedia-extracts.raw.json": {},
    "people-wikipedia-extracts.ru.raw.json": {},
  });

  const [person] = transformPeople();

  assert.equal(person?.name, "Isaac Newton");
  assert.equal(person?.nameRu, "Исаак Ньютон");
});

test("transformPeople leaves name undefined when the Wikidata label enrichment pass didn't resolve one for this QID", (t) => {
  stubRawFiles(t, {
    "people-pantheon.raw.csv": pantheonCsv(pantheonRow()),
    "people-taglines.raw.json": {
      head: { vars: ["person", "tagline"] },
      results: { bindings: [] },
    },
    "people-image-attribution.raw.json": {},
    "people-wikipedia-extracts.raw.json": {},
    "people-wikipedia-extracts.ru.raw.json": {},
  });

  const [person] = transformPeople();

  assert.equal(person?.name, undefined);
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
    "people-wikipedia-extracts.ru.raw.json": {},
  });

  const [person] = transformPeople();

  assert.equal(person?.description, undefined);
});
