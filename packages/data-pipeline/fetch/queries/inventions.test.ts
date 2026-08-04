import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventionsQuery } from "./inventions.js";

test("requires sitelinks >= 30", () => {
  const query = buildInventionsQuery(500, 0, 1800, 1900);
  assert.match(query, /FILTER\(\?sitelinks >= 30\)/);
});

test("filters ?date to the given [minYear, maxYearExclusive) range", () => {
  const query = buildInventionsQuery(500, 0, 1800, 1900);
  assert.match(
    query,
    /FILTER\(\?date >= "1800-01-01T00:00:00Z"\^\^xsd:dateTime && \?date < "1900-01-01T00:00:00Z"\^\^xsd:dateTime\)/,
  );
});

test("formats a negative (BCE) year with a leading minus sign and zero-padded magnitude", () => {
  const query = buildInventionsQuery(500, 0, -800, -400);
  assert.match(query, /"-0800-01-01T00:00:00Z"\^\^xsd:dateTime/);
  assert.match(query, /"-0400-01-01T00:00:00Z"\^\^xsd:dateTime/);
});

test("includes LIMIT and OFFSET from the given page params", () => {
  const query = buildInventionsQuery(500, 1000, 1900, 1950);
  assert.match(query, /LIMIT 500 OFFSET 1000/);
});
