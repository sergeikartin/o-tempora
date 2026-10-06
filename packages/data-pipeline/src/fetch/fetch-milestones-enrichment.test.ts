import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDate } from "./fetch-milestones-enrichment.js";

const wikidata = { year: 1620, month: 7, endYear: 1620, endMonth: 11 };

test("resolveDate keeps the Wikidata date when there is no override", () => {
  assert.deepEqual(resolveDate(undefined, wikidata), wikidata);
});

test("resolveDate supplies a date the Wikidata item lacks", () => {
  assert.deepEqual(resolveDate({ year: 1854, month: 3 }, undefined), {
    year: 1854,
    month: 3,
    endYear: undefined,
    endMonth: undefined,
  });
});

test("resolveDate replaces every field, so an override without an end is point-shaped", () => {
  assert.deepEqual(resolveDate({ year: 1621 }, wikidata), {
    year: 1621,
    month: undefined,
    endYear: undefined,
    endMonth: undefined,
  });
});

test("resolveDate flags an approximate override", () => {
  assert.deepEqual(resolveDate({ year: -138, approximate: true }, wikidata), {
    year: -138,
    month: undefined,
    endYear: undefined,
    endMonth: undefined,
    approximateDate: true,
  });
});
