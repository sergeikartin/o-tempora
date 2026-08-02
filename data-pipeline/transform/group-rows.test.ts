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
