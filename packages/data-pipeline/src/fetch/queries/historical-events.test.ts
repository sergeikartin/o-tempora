import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoricalEventsQuery,
  CONFLICT_CATEGORY_QUERIES,
  BAR_RENDERED_TYPE_QIDS,
  WAR_TYPE_QID,
  WAR_OF_INDEPENDENCE_TYPE_QID,
} from "./historical-events.js";

test("scopes the query to the given type Q-ID via BIND, not a shared VALUES list", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(query, /\?event wdt:P31 wd:Q198 ;/);
  assert.match(query, /BIND\(wd:Q198 AS \?type\)/);
});

test("requires sitelinks >= 70 (the flat per-category fetch floor)", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(query, /FILTER\(\?sitelinks >= 70\)/);
});

test("filters ?date to the given [minYear, maxYearExclusive) range", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(
    query,
    /FILTER\(\?date >= "1800-01-01T00:00:00Z"\^\^xsd:dateTime && \?date < "1900-01-01T00:00:00Z"\^\^xsd:dateTime\)/,
  );
});

test("formats a negative (BCE) year with a leading minus sign and zero-padded magnitude", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, -800, -400);
  assert.match(query, /"-0800-01-01T00:00:00Z"\^\^xsd:dateTime/);
  assert.match(query, /"-0400-01-01T00:00:00Z"\^\^xsd:dateTime/);
});

test("includes LIMIT and OFFSET from the given page params", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 1000, 1900, 1950);
  assert.match(query, /LIMIT 500 OFFSET 1000/);
});

test("binds ?date's precision via the point-in-time/start-time statement value nodes, not the wdt: truthy shortcut", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(query, /\?event p:P585 \?pointInTimeStatement/);
  assert.match(query, /\?pointInTimeStatement psv:P585 \?pointInTimeValue/);
  assert.match(
    query,
    /\?pointInTimeValue wikibase:timeValue \?pointInTime ;\s*wikibase:timePrecision \?pointInTimePrecision/,
  );
  assert.match(query, /\?event p:P580 \?startTimeStatement/);
  assert.match(query, /\?startTimeStatement psv:P580 \?startTimeValue/);
  assert.match(
    query,
    /\?startTimeValue wikibase:timeValue \?startTime ;\s*wikibase:timePrecision \?startTimePrecision/,
  );
  assert.match(query, /BIND\(COALESCE\(\?pointInTime, \?startTime\) AS \?date\)/);
  assert.match(query, /BIND\(COALESCE\(\?pointInTimePrecision, \?startTimePrecision\) AS \?datePrecision\)/);
});

test("binds ?endDate's precision the same way via P582's statement value node", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(query, /\?event p:P582 \?endDateStatement/);
  assert.match(query, /\?endDateStatement psv:P582 \?endDateValue/);
  assert.match(
    query,
    /\?endDateValue wikibase:timeValue \?endDate ;\s*wikibase:timePrecision \?endDatePrecision/,
  );
});

test("selects ?datePrecision and ?endDatePrecision", () => {
  const query = buildHistoricalEventsQuery("Q198", 500, 0, 1800, 1900);
  assert.match(query, /SELECT[^\n]*\?datePrecision/);
  assert.match(query, /SELECT[^\n]*\?endDatePrecision/);
});

test("CONFLICT_CATEGORY_QUERIES has one entry per surviving ConflictCategory value, each with a distinct raw file name", () => {
  assert.equal(CONFLICT_CATEGORY_QUERIES.length, 9);
  const rawFileNames = CONFLICT_CATEGORY_QUERIES.map((entry) => entry.rawFileName);
  assert.equal(new Set(rawFileNames).size, 9);
});

test("BAR_RENDERED_TYPE_QIDS contains exactly war and war-of-independence", () => {
  assert.deepEqual([...BAR_RENDERED_TYPE_QIDS].sort(), [WAR_OF_INDEPENDENCE_TYPE_QID, WAR_TYPE_QID].sort());
});
