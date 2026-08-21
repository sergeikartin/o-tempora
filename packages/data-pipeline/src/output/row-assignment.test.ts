import { test } from "node:test";
import assert from "node:assert/strict";
import type { Conflict, ConflictEvent, Milestone, Person } from "@same-sky/shared-types";
import { assignConflictsMilestonesRows, assignPersonRows, assignRows } from "./row-assignment.js";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "Q868",
    name: "Aristotle",
    lifespan: { start: { year: -383 }, end: { year: -321 } },
    occupationDomain: "humanities",
    regionTags: [],
    fameScore: 90,
    tagline: "4th-century BCE Classical Greek philosopher and polymath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Aristotle",
    ...overrides,
  };
}

function conflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    id: "Q8214",
    name: "Korean War",
    period: { start: { year: 1950 }, end: { year: 1953 } },
    category: "war",
    regionTags: [],
    fameScore: 80,
    tagline: "war on the Korean peninsula",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Korean_War",
    ...overrides,
  };
}

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "Q11042",
    name: "Printing press",
    at: { year: 1440 },
    category: "communication",
    regionTags: [],
    fameScore: 80,
    tagline: "device for applying pressure to transfer ink onto paper",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Printing_press",
    ...overrides,
  };
}

// assignRows — fame-priority interval-graph row stacking, ported verbatim
// from packages/web (docs/adr/0005-row-assignment-moves-to-the-pipeline.md).
// Processes items by fameScore rounded to an integer tier (descending),
// chronologically within a tier, id as the final tie-break.

test("assignRows places two non-overlapping intervals in the same row", () => {
  const rows = assignRows(
    [
      { id: "a", startYear: 1900, endYear: 1910, fameScore: 100 },
      { id: "b", startYear: 1950, endYear: 1960, fameScore: 50 },
    ],
    5,
  );
  assert.equal(rows.get("a"), rows.get("b"));
});

test("assignRows opens a new row for two overlapping intervals", () => {
  const rows = assignRows(
    [
      { id: "a", startYear: 1900, endYear: 1920, fameScore: 100 },
      { id: "b", startYear: 1910, endYear: 1930, fameScore: 50 },
    ],
    5,
  );
  assert.notEqual(rows.get("a"), rows.get("b"));
});

test("assignRows keeps a minimum gap between two intervals sharing a row, even without literal overlap", () => {
  const rows = assignRows(
    [
      { id: "a", startYear: 1900, endYear: 1910, fameScore: 100 },
      { id: "b", startYear: 1911, endYear: 1920, fameScore: 50 },
    ],
    5,
  );
  assert.notEqual(rows.get("a"), rows.get("b"));
});

test("assignRows gives the higher-fame item row 0 when two overlapping items compete for it, regardless of input order", () => {
  const overlapping = [
    { id: "famous", startYear: 1900, endYear: 1920, fameScore: 90 },
    { id: "obscure", startYear: 1910, endYear: 1930, fameScore: 10 },
  ];
  const forward = assignRows(overlapping, 5);
  assert.equal(forward.get("famous"), 0);
  assert.equal(forward.get("obscure"), 1);

  const reversed = assignRows([...overlapping].reverse(), 5);
  assert.equal(reversed.get("famous"), 0);
  assert.equal(reversed.get("obscure"), 1);
});

test("assignRows processes chronologically within the same fame tier, regardless of input order", () => {
  const sameTier = [
    { id: "later", startYear: 1910, endYear: 1930, fameScore: 50.4 },
    { id: "earlier", startYear: 1900, endYear: 1920, fameScore: 49.6 },
  ];
  const forward = assignRows(sameTier, 5);
  const reversed = assignRows([...sameTier].reverse(), 5);
  assert.equal(forward.get("earlier"), 0);
  assert.equal(forward.get("later"), 1);
  assert.equal(reversed.get("earlier"), 0);
  assert.equal(reversed.get("later"), 1);
});

test("assignRows breaks a same-tier, same-start-year tie by id, deterministically regardless of input order", () => {
  const tied = [
    { id: "a", startYear: 1900, endYear: 1920, fameScore: 50 },
    { id: "b", startYear: 1900, endYear: 1930, fameScore: 50 },
  ];
  const forward = assignRows(tied, 5);
  const reversed = assignRows([...tied].reverse(), 5);
  assert.equal(forward.get("a"), 0);
  assert.equal(forward.get("b"), 1);
  assert.equal(reversed.get("a"), 0);
  assert.equal(reversed.get("b"), 1);
});

test("assignRows sorts by the rounded tier, not the raw score — a tiny raw gap across a rounding boundary still separates tiers", () => {
  const overlapping = [
    { id: "tier-89", startYear: 1900, endYear: 1920, fameScore: 89.4 },
    { id: "tier-90", startYear: 1905, endYear: 1925, fameScore: 89.6 },
  ];
  const forward = assignRows(overlapping, 5);
  assert.equal(forward.get("tier-90"), 0);
  assert.equal(forward.get("tier-89"), 1);

  const reversed = assignRows([...overlapping].reverse(), 5);
  assert.equal(reversed.get("tier-90"), 0);
  assert.equal(reversed.get("tier-89"), 1);
});

test("assignRows reuses a row once it clears, rather than always opening a new one", () => {
  const rows = assignRows(
    [
      { id: "a", startYear: 1900, endYear: 1910, fameScore: 100 },
      { id: "b", startYear: 1905, endYear: 1915, fameScore: 90 },
      { id: "c", startYear: 1920, endYear: 1930, fameScore: 80 },
    ],
    5,
  );
  assert.notEqual(rows.get("a"), rows.get("b"));
  assert.equal(rows.get("c"), rows.get("a"));
});

test("assignRows lets a lower-fame item slot in before an already-placed higher-fame item's start, not just after its end", () => {
  const rows = assignRows(
    [
      { id: "famous", startYear: 1950, endYear: 1960, fameScore: 100 },
      { id: "obscure", startYear: 1900, endYear: 1910, fameScore: 10 },
    ],
    5,
  );
  assert.equal(rows.get("famous"), 0);
  assert.equal(rows.get("obscure"), 0);
});

// assignPersonRows / assignConflictsMilestonesRows — the pipeline-side
// derivation of a real Person/Conflict/Milestone's row from its actual
// lifespan/period/at and fameScore, the piece packages/web used to run
// client-side (computeStaticPersonRows/computeStaticConflictsMilestonesRows)
// before this moved to Output time.

test("assignPersonRows gives two time-overlapping people different rows, the more famous one row 0", () => {
  const famous = person({ id: "Q-famous", fameScore: 100 });
  const obscure = person({ id: "Q-obscure", fameScore: 76 });
  const rows = assignPersonRows([famous, obscure]);
  assert.equal(rows.get("Q-famous"), 0);
  assert.notEqual(rows.get("Q-obscure"), 0);
});

test("assignPersonRows gives two non-overlapping people the same row", () => {
  const early = person({ id: "Q-early", lifespan: { start: { year: 1200 }, end: { year: 1250 } } });
  const late = person({ id: "Q-late", lifespan: { start: { year: 1800 }, end: { year: 1850 } } });
  const rows = assignPersonRows([early, late]);
  assert.equal(rows.get("Q-early"), rows.get("Q-late"));
});

test("assignConflictsMilestonesRows packs a non-overlapping Conflict and Milestone into the same row", () => {
  const rows = assignConflictsMilestonesRows([conflict()], [milestone()]);
  assert.equal(rows.get(conflict().id), rows.get(milestone().id));
});

test("assignConflictsMilestonesRows gives an overlapping, more-famous ConflictEvent priority over a Milestone", () => {
  const battle: ConflictEvent = {
    id: "Q-battle",
    name: "Battle",
    at: { year: 1440 },
    category: "war",
    regionTags: [],
    fameScore: 95,
    tagline: "a battle",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Battle",
  };
  const rows = assignConflictsMilestonesRows([battle], [milestone({ id: "Q-overlap", at: { year: 1440 } })]);
  assert.equal(rows.get("Q-battle"), 0);
  assert.notEqual(rows.get("Q-overlap"), 0);
});
