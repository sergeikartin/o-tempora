import { test } from "node:test";
import assert from "node:assert/strict";
import { groupReigns } from "./group-reigns.js";
import type { SparqlBinding } from "../fetch/sparql-result-shape.js";

test("groups multiple reign periods per person, sorted ascending by start year", () => {
  const bindings: SparqlBinding[] = [
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q9682" },
      reignStart: { type: "literal", value: "1660-05-29T00:00:00Z" },
      reignEnd: { type: "literal", value: "1685-02-06T00:00:00Z" },
      positionLabel: { type: "literal", value: "King of England" },
    },
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q9682" },
      reignStart: { type: "literal", value: "1649-01-01T00:00:00Z" },
    },
  ];

  const result = groupReigns(bindings);

  assert.deepEqual(result.get("Q9682"), [
    { startYear: 1649, endYear: undefined, title: undefined },
    { startYear: 1660, endYear: 1685, title: "King of England" },
  ]);
});

test("drops rows with no start year and dedupes exact (start, end) duplicates", () => {
  const bindings: SparqlBinding[] = [
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q1" },
      reignEnd: { type: "literal", value: "1200-01-01T00:00:00Z" },
    },
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q2" },
      reignStart: { type: "literal", value: "-0044-03-15T00:00:00Z" },
    },
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q2" },
      reignStart: { type: "literal", value: "-0044-03-15T00:00:00Z" },
    },
  ];

  const result = groupReigns(bindings);

  assert.equal(result.has("Q1"), false);
  assert.deepEqual(result.get("Q2"), [{ startYear: -44, endYear: undefined, title: undefined }]);
});

test("returns an empty map for no bindings", () => {
  const result = groupReigns([]);
  assert.equal(result.size, 0);
});
