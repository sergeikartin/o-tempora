import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreAndRank,
  scoreAndRankDiscoveries,
  scoreAndRankByHpi,
  FAME_TIER_MIN_SITELINKS_WARS,
  FAME_TIER_MIN_SITELINKS_DISCOVERIES,
  FAME_TIER_MIN_HPI,
} from "./score.js";

test("drops rows below the specialist floor", () => {
  const rows = [{ sitelinks: 29 }, { sitelinks: 30 }, { sitelinks: 5 }];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [30],
  );
});

test("sorts remaining rows descending by sitelinks", () => {
  const rows = [{ sitelinks: 100 }, { sitelinks: 500 }, { sitelinks: 200 }];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [500, 200, 100],
  );
});

test("tier nesting holds: specialist output is a strict superset of what generalPublic/educated would allow", () => {
  const rows = [
    { sitelinks: 30 },
    { sitelinks: 49 },
    { sitelinks: 50 },
    { sitelinks: 99 },
    { sitelinks: 100 },
    { sitelinks: 200 },
  ];
  const specialist = scoreAndRank(rows);
  const generalPublic = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_WARS.generalPublic);
  const educated = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_WARS.educated);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
});

test("scoreAndRankDiscoveries drops rows below Discoveries' (higher) specialist floor", () => {
  const rows = [{ sitelinks: 49 }, { sitelinks: 50 }, { sitelinks: 10 }];
  const result = scoreAndRankDiscoveries(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [50],
  );
});

test("scoreAndRankDiscoveries tier nesting holds against Discoveries' own table", () => {
  const rows = [
    { sitelinks: 50 },
    { sitelinks: 99 },
    { sitelinks: 100 },
    { sitelinks: 199 },
    { sitelinks: 200 },
    { sitelinks: 400 },
  ];
  const specialist = scoreAndRankDiscoveries(rows);
  const generalPublic = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_DISCOVERIES.generalPublic);
  const educated = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_DISCOVERIES.educated);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
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
  const rows = [{ hpi: 90 }, { hpi: 100 }, { hpi: 95 }];
  const result = scoreAndRankByHpi(rows);
  assert.deepEqual(
    result.map((row) => row.hpi),
    [100, 95, 90],
  );
});

test("scoreAndRankByHpi tier nesting holds: specialist output is a strict superset of what generalPublic/educated would allow", () => {
  const rows = [{ hpi: 75 }, { hpi: 84 }, { hpi: 85 }, { hpi: 89 }, { hpi: 90 }, { hpi: 100 }];
  const specialist = scoreAndRankByHpi(rows);
  const generalPublic = rows.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.generalPublic);
  const educated = rows.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.educated);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
});
