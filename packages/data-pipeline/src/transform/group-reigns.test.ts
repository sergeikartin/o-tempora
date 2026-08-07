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
    { start: { year: 1649 }, end: undefined, title: undefined },
    { start: { year: 1660 }, end: { year: 1685 }, title: "King of England" },
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
  assert.deepEqual(result.get("Q2"), [{ start: { year: -44 }, end: undefined, title: undefined }]);
});

test("reads start/end month when each side's own precision claim is month-or-finer", () => {
  const bindings: SparqlBinding[] = [
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q76" },
      reignStart: { type: "literal", value: "2009-01-20T00:00:00Z" },
      reignStartPrecision: { type: "literal", value: "11" },
      reignEnd: { type: "literal", value: "2017-01-20T00:00:00Z" },
      reignEndPrecision: { type: "literal", value: "11" },
      positionLabel: { type: "literal", value: "President of the United States" },
    },
  ];

  const result = groupReigns(bindings);

  assert.deepEqual(result.get("Q76"), [
    {
      start: { year: 2009, month: 1 },
      end: { year: 2017, month: 1 },
      title: "President of the United States",
    },
  ]);
});

test("leaves month unset on either side when that side's precision is coarser than month", () => {
  const bindings: SparqlBinding[] = [
    {
      person: { type: "uri", value: "http://www.wikidata.org/entity/Q1048" },
      reignStart: { type: "literal", value: "-0049-01-01T00:00:00Z" },
      reignStartPrecision: { type: "literal", value: "9" },
      reignEnd: { type: "literal", value: "-0044-03-15T00:00:00Z" },
      reignEndPrecision: { type: "literal", value: "11" },
    },
  ];

  const result = groupReigns(bindings);

  assert.deepEqual(result.get("Q1048"), [{ start: { year: -49 }, end: { year: -44, month: 3 }, title: undefined }]);
});

test("returns an empty map for no bindings", () => {
  const result = groupReigns([]);
  assert.equal(result.size, 0);
});
