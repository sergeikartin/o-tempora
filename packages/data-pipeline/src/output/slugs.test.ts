import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlugs, slugify } from "./slugs.js";

test("slugify folds diacritics and collapses separators", () => {
  assert.equal(slugify("Charlotte Brontë"), "charlotte-bronte");
  assert.equal(slugify("World War II"), "world-war-ii");
  assert.equal(slugify("  Cnut the Great! "), "cnut-the-great");
});

test("slugify returns empty for a name with no ASCII letters or digits", () => {
  assert.equal(slugify("孔子"), "");
});

test("a unique name keeps its plain slug", () => {
  const slugs = assignSlugs([{ id: "Q1", name: "Napoleon", fameScore: 90 }]);
  assert.equal(slugs.get("Q1"), "napoleon");
});

test("of entities sharing a name, the most famous keeps the plain slug and the rest get their id", () => {
  const slugs = assignSlugs([
    { id: "Q2", name: "John Smith", fameScore: 50 },
    { id: "Q1", name: "John Smith", fameScore: 80 },
    { id: "Q3", name: "John Smith", fameScore: 60 },
  ]);
  assert.equal(slugs.get("Q1"), "john-smith");
  assert.equal(slugs.get("Q2"), "john-smith-q2");
  assert.equal(slugs.get("Q3"), "john-smith-q3");
});

test("equal fame is broken by id so the result is deterministic", () => {
  const entities = [
    { id: "Q9", name: "Same", fameScore: 70 },
    { id: "Q4", name: "Same", fameScore: 70 },
  ];
  assert.equal(assignSlugs(entities).get("Q4"), "same");
  assert.equal(assignSlugs([...entities].reverse()).get("Q4"), "same");
});

test("a name with no ASCII characters falls back to the id", () => {
  const slugs = assignSlugs([{ id: "Q7", name: "孔子", fameScore: 90 }]);
  assert.equal(slugs.get("Q7"), "q7");
});

test("a suffixed slug never collides with another entity's own slug", () => {
  const slugs = assignSlugs([
    { id: "Q1", name: "Ann", fameScore: 90 },
    { id: "Q2", name: "Ann", fameScore: 80 },
    { id: "Q3", name: "Ann Q2", fameScore: 10 },
  ]);
  assert.equal(new Set(slugs.values()).size, 3);
});
