import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalEventsQuery } from "./historical-events.js";

test("requires sitelinks >= 30", () => {
  const query = buildHistoricalEventsQuery(500, 0, 1800, 1900);
  assert.match(query, /FILTER\(\?sitelinks >= 30\)/);
});

test("filters ?date to the given [minYear, maxYearExclusive) range", () => {
  const query = buildHistoricalEventsQuery(500, 0, 1800, 1900);
  assert.match(
    query,
    /FILTER\(\?date >= "1800-01-01T00:00:00Z"\^\^xsd:dateTime && \?date < "1900-01-01T00:00:00Z"\^\^xsd:dateTime\)/,
  );
});

test("formats a negative (BCE) year with a leading minus sign and zero-padded magnitude", () => {
  const query = buildHistoricalEventsQuery(500, 0, -800, -400);
  assert.match(query, /"-0800-01-01T00:00:00Z"\^\^xsd:dateTime/);
  assert.match(query, /"-0400-01-01T00:00:00Z"\^\^xsd:dateTime/);
});

test("includes LIMIT and OFFSET from the given page params", () => {
  const query = buildHistoricalEventsQuery(500, 1000, 1900, 1950);
  assert.match(query, /LIMIT 500 OFFSET 1000/);
});

test("binds ?date's precision via the point-in-time/start-time statement value nodes, not the wdt: truthy shortcut", () => {
  const query = buildHistoricalEventsQuery(500, 0, 1800, 1900);
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
  const query = buildHistoricalEventsQuery(500, 0, 1800, 1900);
  assert.match(query, /\?event p:P582 \?endDateStatement/);
  assert.match(query, /\?endDateStatement psv:P582 \?endDateValue/);
  assert.match(
    query,
    /\?endDateValue wikibase:timeValue \?endDate ;\s*wikibase:timePrecision \?endDatePrecision/,
  );
});

test("selects ?datePrecision and ?endDatePrecision", () => {
  const query = buildHistoricalEventsQuery(500, 0, 1800, 1900);
  assert.match(query, /SELECT[^\n]*\?datePrecision/);
  assert.match(query, /SELECT[^\n]*\?endDatePrecision/);
});
