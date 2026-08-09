import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEventsEnrichmentQuery } from "./events-enrichment.js";

test("VALUES clause includes one wd: entry per given QID", () => {
  const query = buildEventsEnrichmentQuery(["Q988780", "Q20124"]);
  assert.match(query, /VALUES \?event \{ wd:Q988780 wd:Q20124 \}/);
});

test("requires wikibase:sitelinks, and leaves article/country/image optional", () => {
  const query = buildEventsEnrichmentQuery(["Q1"]);
  assert.match(query, /\?event wikibase:sitelinks \?sitelinks \./);
  assert.match(query, /OPTIONAL \{ \?article schema:about \?event; schema:isPartOf <https:\/\/en\.wikipedia\.org\/>\. \}/);
  assert.match(query, /OPTIONAL \{ \?event wdt:P17 \?country\. \}/);
  assert.match(query, /OPTIONAL \{ \?event wdt:P18 \?image\. \}/);
});
