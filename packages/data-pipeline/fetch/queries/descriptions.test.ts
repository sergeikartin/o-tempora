import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDescriptionsQuery } from "./descriptions.js";

test("builds a VALUES clause from wd:-prefixed person QIDs", () => {
  const query = buildDescriptionsQuery(["Q935", "Q9441"]);
  assert.match(query, /VALUES \?person \{ wd:Q935 wd:Q9441 \}/);
  assert.match(query, /OPTIONAL \{ \?person schema:description \?description \. FILTER\(LANG\(\?description\) = "en"\) \}/);
});

test("handles a single-id batch", () => {
  const query = buildDescriptionsQuery(["Q1"]);
  assert.match(query, /VALUES \?person \{ wd:Q1 \}/);
});
