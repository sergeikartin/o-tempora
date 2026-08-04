import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreAndRank, FAME_TIER_MIN_SITELINKS } from "./score.js";

test("drops rows below the specialist floor", () => {
  const rows = [{ sitelinks: 29 }, { sitelinks: 30 }, { sitelinks: 5 }];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [30],
  );
});

test("sorts remaining rows descending by sitelinks", () => {
  const rows = [{ sitelinks: 30 }, { sitelinks: 500 }, { sitelinks: 100 }];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [500, 100, 30],
  );
});

test("tier nesting holds: educated and generalPublic are strict subsets of specialist output", () => {
  const rows = [
    { sitelinks: 30 },
    { sitelinks: 49 },
    { sitelinks: 50 },
    { sitelinks: 99 },
    { sitelinks: 100 },
    { sitelinks: 200 },
  ];
  const specialist = scoreAndRank(rows);
  const educated = specialist.filter(
    (row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS.educated,
  );
  const generalPublic = specialist.filter(
    (row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS.generalPublic,
  );

  assert.equal(specialist.length, 6);
  assert.equal(educated.length, 4);
  assert.equal(generalPublic.length, 2);
  assert.ok(educated.every((row) => specialist.includes(row)));
  assert.ok(generalPublic.every((row) => educated.includes(row)));
});
