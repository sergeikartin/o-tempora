import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMilestonesEnrichmentQuery } from "./milestones-enrichment.js";
import { PAGEVIEWS_LANGUAGES } from "../pageviews-languages.js";

test("VALUES clause includes one wd: entry per given QID", () => {
  const query = buildMilestonesEnrichmentQuery(["Q988780", "Q20124"]);
  assert.match(query, /VALUES \?event \{ wd:Q988780 wd:Q20124 \}/);
});

test("requires wikibase:sitelinks, and leaves a per-language article title, country, image, and tagline optional", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  assert.match(query, /\?event wikibase:sitelinks \?sitelinks \./);
  assert.equal(PAGEVIEWS_LANGUAGES.length, 7);
  for (const lang of PAGEVIEWS_LANGUAGES) {
    const varName = `article${lang[0]!.toUpperCase()}${lang.slice(1)}`;
    const pattern = new RegExp(
      `OPTIONAL \\{ \\?${varName} schema:about \\?event; schema:isPartOf <https://${lang}\\.wikipedia\\.org/>\\. \\}`,
    );
    assert.match(query, pattern);
  }
  assert.match(query, /OPTIONAL \{ \?event wdt:P17 \?country\. \}/);
  assert.match(query, /OPTIONAL \{ \?event wdt:P18 \?image\. \}/);
  assert.match(query, /OPTIONAL \{ \?event schema:description \?tagline \. FILTER\(LANG\(\?tagline\) = "en"\) \}/);
});

test("selects sitelinks/per-language article title vars/country/image/tagline", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `\\?article${lang[0]!.toUpperCase()}${lang.slice(1)}`).join(
    " ",
  );
  const pattern = new RegExp(`SELECT \\?event \\?sitelinks ${articleVars} \\?country \\?image \\?tagline WHERE`);
  assert.match(query, pattern);
});
