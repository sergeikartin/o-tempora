import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreAndRank, scoreAndRankByHpi, FAME_TIER_MIN_SITELINKS, FAME_TIER_MIN_HPI } from "./score.js";

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

test("scoreAndRankByHpi drops rows below the specialist floor", () => {
  const rows = [{ hpi: 74 }, { hpi: 75 }, { hpi: 10 }];
  const result = scoreAndRankByHpi(rows);
  assert.deepEqual(
    result.map((row) => row.hpi),
    [75],
  );
});

test("scoreAndRankByHpi sorts remaining rows descending by hpi", () => {
  const rows = [{ hpi: 75 }, { hpi: 100 }, { hpi: 90 }];
  const result = scoreAndRankByHpi(rows);
  assert.deepEqual(
    result.map((row) => row.hpi),
    [100, 90, 75],
  );
});

test("scoreAndRankByHpi tier nesting holds: educated and generalPublic are strict subsets of specialist output", () => {
  const rows = [{ hpi: 75 }, { hpi: 84 }, { hpi: 85 }, { hpi: 89 }, { hpi: 90 }, { hpi: 100 }];
  const specialist = scoreAndRankByHpi(rows);
  const educated = specialist.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.educated);
  const generalPublic = specialist.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.generalPublic);

  assert.equal(specialist.length, 6);
  assert.equal(educated.length, 4);
  assert.equal(generalPublic.length, 2);
  assert.ok(educated.every((row) => specialist.includes(row)));
  assert.ok(generalPublic.every((row) => educated.includes(row)));
});
