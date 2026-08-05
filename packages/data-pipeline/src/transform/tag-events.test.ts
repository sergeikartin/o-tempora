import { test } from "node:test";
import assert from "node:assert/strict";
import type { GroupedRow } from "./group-rows.js";
import { tagHistoricalEvent, tagInvention } from "./tag-events.js";
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

// This is the invariant the Wars/Discoveries output split (wars.json vs
// discoveries.json) relies on: the two lanes never share a category, so
// splitting by source before scoring can never lose or duplicate a row
// relative to today's single-file behavior.
test("tagHistoricalEvent never produces the invention category, for any known type QID", () => {
  for (const [typeId, category] of Object.entries(EVENT_TYPE_CATEGORIES)) {
    assert.notEqual(category, "invention", `type ${typeId} unexpectedly mapped to "invention"`);
  }
});

test("tagInvention always returns the invention category, regardless of the row's own tags", () => {
  assert.equal(tagInvention(groupedRow()).category, "invention");
  assert.equal(tagInvention(groupedRow({ tags: [WAR_TYPE_QID] })).category, "invention");
});
