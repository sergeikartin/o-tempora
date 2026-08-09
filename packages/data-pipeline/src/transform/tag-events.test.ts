import { test } from "node:test";
import assert from "node:assert/strict";
import { tagCuratedDiscovery, tagCuratedWar } from "./tag-events.js";

test("tagCuratedDiscovery passes the given category straight through", () => {
  assert.equal(tagCuratedDiscovery("science-theory", []).category, "science-theory");
  assert.equal(tagCuratedDiscovery("exploration", []).category, "exploration");
});

test("tagCuratedDiscovery maps countries to regionTags", () => {
  const { regionTags } = tagCuratedDiscovery("transportation", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});

test("tagCuratedWar passes the given category straight through", () => {
  assert.equal(tagCuratedWar("revolution", []).category, "revolution");
  assert.equal(tagCuratedWar("war-of-independence", []).category, "war-of-independence");
});

test("tagCuratedWar maps countries to regionTags the same way tagCuratedDiscovery does", () => {
  const { regionTags } = tagCuratedWar("war", ["Q142"]);
  assert.deepEqual(regionTags, ["europe"]);
});
