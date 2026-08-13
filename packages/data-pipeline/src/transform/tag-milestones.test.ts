import { test } from "node:test";
import assert from "node:assert/strict";
import { tagCuratedMilestone, tagCuratedConflict } from "./tag-milestones.js";

test("tagCuratedMilestone passes the given category straight through", () => {
  assert.equal(tagCuratedMilestone("science-theory", []).category, "science-theory");
  assert.equal(tagCuratedMilestone("expedition", []).category, "expedition");
});

test("tagCuratedMilestone maps countries to regionTags", () => {
  const { regionTags } = tagCuratedMilestone("transportation", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});

test("tagCuratedConflict passes the given category straight through", () => {
  assert.equal(tagCuratedConflict("revolution", []).category, "revolution");
  assert.equal(tagCuratedConflict("war-of-independence", []).category, "war-of-independence");
});

test("tagCuratedConflict maps countries to regionTags the same way tagCuratedMilestone does", () => {
  const { regionTags } = tagCuratedConflict("war", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});
