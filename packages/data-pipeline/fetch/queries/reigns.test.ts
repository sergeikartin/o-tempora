import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReignsQuery } from "./reigns.js";

test("builds a VALUES clause from wd:-prefixed person QIDs", () => {
  const query = buildReignsQuery(["Q9682", "Q1394"]);
  assert.match(query, /VALUES \?person \{ wd:Q9682 wd:Q1394 \}/);
  assert.match(query, /\?person p:P39 \?statement/);
  assert.match(query, /\?statement pq:P580 \?reignStart/);
  assert.match(query, /OPTIONAL \{ \?statement pq:P582 \?reignEnd \. \}/);
});

test("handles a single-id batch", () => {
  const query = buildReignsQuery(["Q1"]);
  assert.match(query, /VALUES \?person \{ wd:Q1 \}/);
});
