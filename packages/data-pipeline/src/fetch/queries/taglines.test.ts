import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaglinesQuery } from "./taglines.js";

test("builds a VALUES clause from wd:-prefixed person QIDs", () => {
  const query = buildTaglinesQuery(["Q935", "Q9441"]);
  assert.match(query, /VALUES \?person \{ wd:Q935 wd:Q9441 \}/);
  assert.match(query, /OPTIONAL \{ \?person schema:description \?tagline \. FILTER\(LANG\(\?tagline\) = "en"\) \}/);
});

test("also selects and backfills the P18 image claim on the same ?person", () => {
  const query = buildTaglinesQuery(["Q935"]);
  assert.match(query, /SELECT \?person \?tagline \?image WHERE/);
  assert.match(query, /OPTIONAL \{ \?person wdt:P18 \?image \. \}/);
});

test("handles a single-id batch", () => {
  const query = buildTaglinesQuery(["Q1"]);
  assert.match(query, /VALUES \?person \{ wd:Q1 \}/);
});
