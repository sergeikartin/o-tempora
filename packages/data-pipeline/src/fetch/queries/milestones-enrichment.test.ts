import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMilestonesEnrichmentQuery } from "./milestones-enrichment.js";
import { PAGEVIEWS_LANGUAGES } from "../pageviews-languages.js";

const DATE_PROPERTIES = ["P575", "P571", "P577", "P580", "P585", "P569", "P606", "P619", "P729", "P1619"];

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

test("binds each of the 10 curator dateProperty candidates' precision via the statement value nodes, not the wdt: truthy shortcut", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  for (const property of DATE_PROPERTIES) {
    const v = property.toLowerCase();
    assert.match(query, new RegExp(`\\?event p:${property} \\?${v}Statement`));
    assert.match(query, new RegExp(`\\?${v}Statement a wikibase:BestRank \\.`));
    assert.match(query, new RegExp(`\\?${v}Statement psv:${property} \\?${v}Value`));
    assert.match(query, new RegExp(`\\?${v}Value wikibase:timeValue \\?${v}Time ;\\s*wikibase:timePrecision \\?${v}Precision`));
  }
});

test("COALESCEs ?date/?datePrecision across all 10 date properties in curator-priority order", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  const timeVars = DATE_PROPERTIES.map((p) => `\\?${p.toLowerCase()}Time`).join(", ");
  const precisionVars = DATE_PROPERTIES.map((p) => `\\?${p.toLowerCase()}Precision`).join(", ");
  assert.match(query, new RegExp(`BIND\\(COALESCE\\(${timeVars}\\) AS \\?date\\)`));
  assert.match(query, new RegExp(`BIND\\(COALESCE\\(${precisionVars}\\) AS \\?datePrecision\\)`));
});

test("binds ?endDate's precision the same way via P582's statement value node, independent of DATE_PROPERTIES' COALESCE chain", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  assert.match(query, /\?event p:P582 \?endDateStatement/);
  assert.match(query, /\?endDateStatement a wikibase:BestRank \./);
  assert.match(query, /\?endDateStatement psv:P582 \?endDateValue/);
  assert.match(query, /\?endDateValue wikibase:timeValue \?endDate ;\s*wikibase:timePrecision \?endDatePrecision/);
});

test("selects sitelinks/per-language article title vars/country/image/tagline/date/datePrecision/endDate/endDatePrecision", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `\\?article${lang[0]!.toUpperCase()}${lang.slice(1)}`).join(
    " ",
  );
  const pattern = new RegExp(
    `SELECT \\?event \\?sitelinks ${articleVars} \\?country \\?image \\?tagline \\?date \\?datePrecision \\?endDate \\?endDatePrecision WHERE`,
  );
  assert.match(query, pattern);
});

test("does not filter by year range or page with LIMIT/OFFSET (a batch of already-curated ids, not a corpus scan)", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  assert.doesNotMatch(query, /FILTER\(\?date/);
  assert.doesNotMatch(query, /LIMIT/);
  assert.doesNotMatch(query, /OFFSET/);
});

test("orders by event/date/endDate so the earliest date wins as a tiebreak when an item carries two equally-best-ranked claims on the same winning property", () => {
  const query = buildMilestonesEnrichmentQuery(["Q1"]);
  assert.match(query, /ORDER BY \?event \?date \?endDate\s*$/);
});
