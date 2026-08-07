import { test } from "node:test";
import assert from "node:assert/strict";
import type { GroupedRow } from "./group-rows.js";
import { tagHistoricalEvent, tagCuratedDiscovery } from "./tag-events.js";
import { EVENT_TYPE_CATEGORIES } from "./event-type-categories.js";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

function groupedRow(overrides: Partial<GroupedRow> = {}): GroupedRow {
  return {
    id: "Q1",
    sitelinks: 100,
    tags: [],
    countries: [],
    ...overrides,
  };
}

test("tagHistoricalEvent maps the war type QID to the war category", () => {
  const { category } = tagHistoricalEvent(groupedRow({ tags: [WAR_TYPE_QID] }));
  assert.equal(category, "war");
});

test("tagHistoricalEvent maps a treaty to the politics category", () => {
  const { category } = tagHistoricalEvent(groupedRow({ tags: ["Q131569"] }));
  assert.equal(category, "politics");
});

test("tagHistoricalEvent leaves category undefined for an unmapped type QID", () => {
  const { category } = tagHistoricalEvent(groupedRow({ tags: ["Q999999"] }));
  assert.equal(category, undefined);
});

test("tagCuratedDiscovery passes the given category straight through, unlike tagHistoricalEvent's lookup", () => {
  assert.equal(tagCuratedDiscovery("science-theory", []).category, "science-theory");
  assert.equal(tagCuratedDiscovery("exploration", []).category, "exploration");
});

test("tagCuratedDiscovery maps countries to regionTags the same way tagHistoricalEvent does", () => {
  const { regionTags } = tagCuratedDiscovery("transportation", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});
