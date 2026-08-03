import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPeopleQuery } from "./people.js";

test("filters birthDate to the given [minYear, maxYearExclusive) range", () => {
  const query = buildPeopleQuery(500, 0, 1800, 1900);
  assert.match(
    query,
    /FILTER\(\?birthDate >= "1800-01-01T00:00:00Z"\^\^xsd:dateTime && \?birthDate < "1900-01-01T00:00:00Z"\^\^xsd:dateTime\)/,
  );
});

test("formats a negative (BCE) year with a leading minus sign and zero-padded magnitude", () => {
  const query = buildPeopleQuery(500, 0, -800, -400);
  assert.match(query, /"-0800-01-01T00:00:00Z"\^\^xsd:dateTime/);
  assert.match(query, /"-0400-01-01T00:00:00Z"\^\^xsd:dateTime/);
});

test("still requires sitelinks > 20", () => {
  const query = buildPeopleQuery(500, 0, 1900, 1950);
  assert.match(query, /FILTER\(\?sitelinks > 20\)/);
});

test("includes LIMIT and OFFSET from the given page params", () => {
  const query = buildPeopleQuery(500, 1000, 1900, 1950);
  assert.match(query, /LIMIT 500 OFFSET 1000/);
});
