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

test("tagHistoricalEvent maps each of the 9 surviving type QIDs 1:1 onto its own ConflictCategory, no collapsing", () => {
  const cases: Array<[string, string]> = [
    ["Q198", "war"],
    ["Q178561", "battle"],
    ["Q188055", "siege"],
    ["Q645883", "military-operation"],
    ["Q10931", "revolution"],
    ["Q124734", "rebellion"],
    ["Q45382", "coup-d-etat"],
    ["Q1006311", "war-of-independence"],
    ["Q625298", "peace-treaty"],
  ];
  for (const [typeId, expectedCategory] of cases) {
    const { category } = tagHistoricalEvent(groupedRow({ tags: [typeId] }));
    assert.equal(category, expectedCategory, `expected ${typeId} -> ${expectedCategory}`);
  }
});

test("tagHistoricalEvent leaves category undefined for the dropped generic treaty QID (Q131569 is no longer mapped)", () => {
  const { category } = tagHistoricalEvent(groupedRow({ tags: ["Q131569"] }));
  assert.equal(category, undefined);
});

test("tagHistoricalEvent leaves category undefined for an unmapped type QID", () => {
  const { category } = tagHistoricalEvent(groupedRow({ tags: ["Q999999"] }));
  assert.equal(category, undefined);
});

test("EVENT_TYPE_CATEGORIES has exactly 9 entries (armistice dropped, no collapsing)", () => {
  assert.equal(Object.keys(EVENT_TYPE_CATEGORIES).length, 9);
});

test("tagCuratedDiscovery passes the given category straight through, unlike tagHistoricalEvent's lookup", () => {
  assert.equal(tagCuratedDiscovery("science-theory", []).category, "science-theory");
  assert.equal(tagCuratedDiscovery("exploration", []).category, "exploration");
});

test("tagCuratedDiscovery maps countries to regionTags the same way tagHistoricalEvent does", () => {
  const { regionTags } = tagCuratedDiscovery("transportation", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});
