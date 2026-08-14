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
  assert.match(query, /SELECT \?person \?nameEn \?nameRu \?tagline \?taglineRu \?image \?articleRu WHERE/);
  assert.match(query, /OPTIONAL \{ \?person wdt:P18 \?image \. \}/);
});

test("fetches a Russian Wikipedia article title, the same schema:about\\/isPartOf pattern Conflicts\\/Milestones use", () => {
  const query = buildTaglinesQuery(["Q935"]);
  assert.match(query, /OPTIONAL \{ \?articleRu schema:about \?person; schema:isPartOf <https:\/\/ru\.wikipedia\.org\/>\. \}/);
});

test("fetches an English and Russian rdfs:label for name, and a Russian tagline binding alongside the English one, both optional", () => {
  const query = buildTaglinesQuery(["Q935"]);
  assert.match(query, /OPTIONAL \{ \?person rdfs:label \?nameEn \. FILTER\(LANG\(\?nameEn\) = "en"\) \}/);
  assert.match(query, /OPTIONAL \{ \?person rdfs:label \?nameRu \. FILTER\(LANG\(\?nameRu\) = "ru"\) \}/);
  assert.match(query, /OPTIONAL \{ \?person schema:description \?taglineRu \. FILTER\(LANG\(\?taglineRu\) = "ru"\) \}/);
});

test("handles a single-id batch", () => {
  const query = buildTaglinesQuery(["Q1"]);
  assert.match(query, /VALUES \?person \{ wd:Q1 \}/);
});
