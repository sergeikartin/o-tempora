import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupeFirstById } from "./index.js";

test("dedupeFirstById keeps only the first row seen for a given id", () => {
  const rows = [
    { id: "Q1", category: "war" },
    { id: "Q1", category: "military-operation" },
  ];
  assert.deepEqual(dedupeFirstById(rows), [{ id: "Q1", category: "war" }]);
});

test("dedupeFirstById leaves rows with distinct ids untouched, in order", () => {
  const rows = [{ id: "Q1" }, { id: "Q2" }, { id: "Q3" }];
  assert.deepEqual(dedupeFirstById(rows), rows);
});

test("dedupeFirstById handles an empty array", () => {
  assert.deepEqual(dedupeFirstById([]), []);
});
