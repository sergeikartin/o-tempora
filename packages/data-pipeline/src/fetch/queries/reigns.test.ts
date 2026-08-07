import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReignsQuery } from "./reigns.js";

test("builds a VALUES clause from wd:-prefixed person QIDs", () => {
  const query = buildReignsQuery(["Q9682", "Q1394"]);
  assert.match(query, /VALUES \?person \{ wd:Q9682 wd:Q1394 \}/);
  assert.match(query, /VALUES \?leadershipType \{ wd:Q48352 wd:Q2285706 \}/);
  assert.match(query, /\?person p:P39 \?statement/);
  assert.match(query, /\?statement ps:P39 \?position/);
  assert.match(query, /\?position wdt:P279\* \?leadershipType/);
  assert.match(query, /\?statement pqv:P580 \?reignStartValue/);
  assert.match(query, /OPTIONAL \{\s*\?statement pqv:P582 \?reignEndValue/);
  assert.match(query, /OPTIONAL \{ \?position rdfs:label \?positionLabel/);
  assert.match(query, /CONTAINS\(LCASE\(\?positionLabel\), "emeritus"\)/);
});

test("handles a single-id batch", () => {
  const query = buildReignsQuery(["Q1"]);
  assert.match(query, /VALUES \?person \{ wd:Q1 \}/);
});

test("binds reignStart/reignEnd's precision via each qualifier's own value node (pqv:)", () => {
  const query = buildReignsQuery(["Q9682"]);
  assert.match(query, /\?statement pqv:P580 \?reignStartValue/);
  assert.match(
    query,
    /\?reignStartValue wikibase:timeValue \?reignStart ;\s*wikibase:timePrecision \?reignStartPrecision/,
  );
  assert.match(query, /OPTIONAL \{\s*\?statement pqv:P582 \?reignEndValue/);
  assert.match(
    query,
    /\?reignEndValue wikibase:timeValue \?reignEnd ;\s*wikibase:timePrecision \?reignEndPrecision/,
  );
});

test("selects ?reignStartPrecision and ?reignEndPrecision", () => {
  const query = buildReignsQuery(["Q9682"]);
  assert.match(query, /SELECT[^\n]*\?reignStartPrecision/);
  assert.match(query, /SELECT[^\n]*\?reignEndPrecision/);
});
