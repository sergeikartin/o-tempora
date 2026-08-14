import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConflictsEnrichmentQuery } from "./conflicts-enrichment.js";
import { PAGEVIEWS_LANGUAGES } from "../pageviews-languages.js";

test("batches ids into a single VALUES clause of wd: prefixed QIDs", () => {
  const query = buildConflictsEnrichmentQuery(["Q198", "Q362"]);
  assert.match(query, /VALUES \?event \{ wd:Q198 wd:Q362 \}/);
});

test("requires sitelinks (no floor — curated ids are already hand-vetted)", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.match(query, /\?event wikibase:sitelinks \?sitelinks \./);
  assert.doesNotMatch(query, /FILTER\(\?sitelinks/);
});

test("fetches a Wikipedia article title per pageviews-basket language, country, image, and English tagline, all optional", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
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

test("fetches an English and Russian rdfs:label for name, and a Russian tagline binding alongside the English one, both optional", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.match(query, /OPTIONAL \{ \?event rdfs:label \?nameEn \. FILTER\(LANG\(\?nameEn\) = "en"\) \}/);
  assert.match(query, /OPTIONAL \{ \?event rdfs:label \?nameRu \. FILTER\(LANG\(\?nameRu\) = "ru"\) \}/);
  assert.match(query, /OPTIONAL \{ \?event schema:description \?taglineRu \. FILTER\(LANG\(\?taglineRu\) = "ru"\) \}/);
});

test("binds ?date's precision via the point-in-time/start-time statement value nodes, not the wdt: truthy shortcut", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
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
  assert.match(query, /BIND\(COALESCE\(\?startTime, \?pointInTime\) AS \?date\)/);
  assert.match(query, /BIND\(COALESCE\(\?startTimePrecision, \?pointInTimePrecision\) AS \?datePrecision\)/);
});

test("binds ?endDate's precision the same way via P582's statement value node", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.match(query, /\?event p:P582 \?endDateStatement/);
  assert.match(query, /\?endDateStatement psv:P582 \?endDateValue/);
  assert.match(query, /\?endDateValue wikibase:timeValue \?endDate ;\s*wikibase:timePrecision \?endDatePrecision/);
});

test("selects sitelinks/per-language article title vars/country/image/name(en+ru)/tagline(en+ru)/date/datePrecision/endDate/endDatePrecision", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `\\?article${lang[0]!.toUpperCase()}${lang.slice(1)}`).join(
    " ",
  );
  const pattern = new RegExp(
    `SELECT \\?event \\?sitelinks ${articleVars} \\?country \\?image \\?nameEn \\?nameRu \\?tagline \\?taglineRu \\?date \\?datePrecision \\?endDate \\?endDatePrecision WHERE`,
  );
  assert.match(query, pattern);
});

test("restricts each of the point-in-time/start-time/end-time statements to wikibase:BestRank, so a Preferred-rank claim always wins over a Normal-rank one", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.match(query, /\?pointInTimeStatement a wikibase:BestRank \./);
  assert.match(query, /\?startTimeStatement a wikibase:BestRank \./);
  assert.match(query, /\?endDateStatement a wikibase:BestRank \./);
});

test("orders by event/date/endDate so the earliest date wins as a tiebreak among multiple equally-best-ranked claims", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.match(query, /ORDER BY \?event \?date \?endDate\s*$/);
});

test("does not filter by year range or page with LIMIT/OFFSET (a batch of already-curated ids, not a corpus scan)", () => {
  const query = buildConflictsEnrichmentQuery(["Q198"]);
  assert.doesNotMatch(query, /FILTER\(\?date/);
  assert.doesNotMatch(query, /LIMIT/);
  assert.doesNotMatch(query, /OFFSET/);
});
