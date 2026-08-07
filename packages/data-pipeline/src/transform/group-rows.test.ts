import { test } from "node:test";
import assert from "node:assert/strict";
import { groupRows } from "./group-rows.js";

test("collapses denormalized rows sharing the same entity URI into one grouped record", () => {
  const bindings = [
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q1" },
      personLabel: { type: "literal", value: "Ada Lovelace", "xml:lang": "en" },
      birthDate: { type: "literal", value: "1815-12-10T00:00:00Z" },
      deathDate: { type: "literal", value: "1852-11-27T00:00:00Z" },
      sitelinks: { type: "literal", value: "150" },
      occupation: { type: "uri", value: "http://www.wikidata.org/entity/Q170790" },
      country: { type: "uri", value: "http://www.wikidata.org/entity/Q145" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Ada_Lovelace" },
      description: { type: "literal", value: "English mathematician", "xml:lang": "en" },
    },
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q1" },
      personLabel: { type: "literal", value: "Ada Lovelace", "xml:lang": "en" },
      birthDate: { type: "literal", value: "1815-12-10T00:00:00Z" },
      deathDate: { type: "literal", value: "1852-11-27T00:00:00Z" },
      sitelinks: { type: "literal", value: "150" },
      occupation: { type: "uri", value: "http://www.wikidata.org/entity/Q82594" },
      country: { type: "uri", value: "http://www.wikidata.org/entity/Q145" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Ada_Lovelace" },
      description: { type: "literal", value: "English mathematician", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "person",
    labelVar: "personLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "birthDate",
    secondaryDateVar: "deathDate",
    tagVar: "occupation",
    countryVar: "country",
  });

  assert.equal(result.length, 1);
  const [entity] = result;
  assert.ok(entity);
  assert.equal(entity.id, "Q1");
  assert.equal(entity.label, "Ada Lovelace");
  assert.equal(entity.sitelinks, 150);
  assert.equal(entity.year, 1815);
  assert.equal(entity.secondaryYear, 1852);
  assert.deepEqual(entity.tags, ["Q170790", "Q82594"]);
  assert.deepEqual(entity.countries, ["Q145"]);
  assert.equal(entity.article, "https://en.wikipedia.org/wiki/Ada_Lovelace");
  assert.equal(entity.description, "English mathematician");
});

test("parses BCE ISO dates as negative years", () => {
  const bindings = [
    {
      event: { type: "uri", value: "http://www.wikidata.org/entity/Q2" },
      eventLabel: { type: "literal", value: "Battle of Marathon", "xml:lang": "en" },
      date: { type: "literal", value: "-0489-09-12T00:00:00Z" },
      sitelinks: { type: "literal", value: "80" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Battle_of_Marathon" },
      description: { type: "literal", value: "battle", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "event",
    labelVar: "eventLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "date",
    countryVar: "country",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.year, -489);
});

test("reads month when the date's precision claim is month-or-finer (>= 10)", () => {
  const bindings = [
    {
      event: { type: "uri", value: "http://www.wikidata.org/entity/Q2" },
      eventLabel: { type: "literal", value: "Battle of Marathon", "xml:lang": "en" },
      date: { type: "literal", value: "-0489-09-12T00:00:00Z" },
      datePrecision: { type: "literal", value: "11" },
      sitelinks: { type: "literal", value: "80" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Battle_of_Marathon" },
      description: { type: "literal", value: "battle", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "event",
    labelVar: "eventLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "date",
    datePrecisionVar: "datePrecision",
    countryVar: "country",
  });

  assert.equal(result[0]?.year, -489);
  assert.equal(result[0]?.month, 9);
});

test("leaves month unset when the date's precision claim is coarser than month (< 10, e.g. year precision)", () => {
  const bindings = [
    {
      event: { type: "uri", value: "http://www.wikidata.org/entity/Q3" },
      eventLabel: { type: "literal", value: "Some ancient event", "xml:lang": "en" },
      date: { type: "literal", value: "-1257-01-01T00:00:00Z" },
      datePrecision: { type: "literal", value: "9" },
      sitelinks: { type: "literal", value: "40" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Some_ancient_event" },
      description: { type: "literal", value: "event", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "event",
    labelVar: "eventLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "date",
    datePrecisionVar: "datePrecision",
    countryVar: "country",
  });

  assert.equal(result[0]?.year, -1257);
  assert.equal(result[0]?.month, undefined);
});

test("leaves month unset when no datePrecisionVar is configured at all", () => {
  const bindings = [
    {
      event: { type: "uri", value: "http://www.wikidata.org/entity/Q4" },
      eventLabel: { type: "literal", value: "Undated-precision event", "xml:lang": "en" },
      date: { type: "literal", value: "1815-06-18T00:00:00Z" },
      sitelinks: { type: "literal", value: "40" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/Undated" },
      description: { type: "literal", value: "event", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "event",
    labelVar: "eventLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "date",
    countryVar: "country",
  });

  assert.equal(result[0]?.month, undefined);
});

test("reads secondaryMonth from secondaryDatePrecisionVar independently of the primary date's precision", () => {
  const bindings = [
    {
      event: { type: "uri", value: "http://www.wikidata.org/entity/Q5" },
      eventLabel: { type: "literal", value: "A war", "xml:lang": "en" },
      date: { type: "literal", value: "1950-06-25T00:00:00Z" },
      datePrecision: { type: "literal", value: "9" },
      endDate: { type: "literal", value: "1953-07-27T00:00:00Z" },
      endDatePrecision: { type: "literal", value: "11" },
      sitelinks: { type: "literal", value: "300" },
      article: { type: "uri", value: "https://en.wikipedia.org/wiki/A_war" },
      description: { type: "literal", value: "war", "xml:lang": "en" },
    },
  ];

  const result = groupRows(bindings, {
    entityVar: "event",
    labelVar: "eventLabel",
    sitelinksVar: "sitelinks",
    articleVar: "article",
    descriptionVar: "description",
    dateVar: "date",
    datePrecisionVar: "datePrecision",
    secondaryDateVar: "endDate",
    secondaryDatePrecisionVar: "endDatePrecision",
    countryVar: "country",
  });

  assert.equal(result[0]?.year, 1950);
  assert.equal(result[0]?.month, undefined);
  assert.equal(result[0]?.secondaryYear, 1953);
  assert.equal(result[0]?.secondaryMonth, 7);
});
