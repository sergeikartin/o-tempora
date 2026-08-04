import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalEventsQuery } from "./historical-events.js";

test("requires sitelinks >= 30", () => {
  const query = buildHistoricalEventsQuery(500, 0);
  assert.match(query, /FILTER\(\?sitelinks >= 30\)/);
});
