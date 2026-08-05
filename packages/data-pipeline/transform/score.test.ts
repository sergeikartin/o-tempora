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

test("drops rows below the generalPublic floor", () => {
  const rows = [{ sitelinks: 99 }, { sitelinks: 100 }, { sitelinks: 5 }];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [100],
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

test("tier nesting holds: generalPublic output is a strict subset of what educated/specialist would allow", () => {
  const rows = [
    { sitelinks: 30 },
    { sitelinks: 49 },
    { sitelinks: 50 },
    { sitelinks: 99 },
    { sitelinks: 100 },
    { sitelinks: 200 },
  ];
  const generalPublic = scoreAndRank(rows);
  const educated = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_WARS.educated);
  const specialist = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_WARS.specialist);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
});

test("scoreAndRankDiscoveries drops rows below Discoveries' (higher) generalPublic floor", () => {
  const rows = [{ sitelinks: 199 }, { sitelinks: 200 }, { sitelinks: 100 }];
  const result = scoreAndRankDiscoveries(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [200],
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
  const generalPublic = scoreAndRankDiscoveries(rows);
  const educated = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_DISCOVERIES.educated);
  const specialist = rows.filter((row) => row.sitelinks >= FAME_TIER_MIN_SITELINKS_DISCOVERIES.specialist);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
});

test("scoreAndRankByHpi drops rows below the generalPublic floor", () => {
  const rows = [{ hpi: 89 }, { hpi: 90 }, { hpi: 10 }];
  const result = scoreAndRankByHpi(rows);
  assert.deepEqual(
    result.map((row) => row.hpi),
    [90],
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

test("scoreAndRankByHpi tier nesting holds: generalPublic output is a strict subset of what educated/specialist would allow", () => {
  const rows = [{ hpi: 75 }, { hpi: 84 }, { hpi: 85 }, { hpi: 89 }, { hpi: 90 }, { hpi: 100 }];
  const generalPublic = scoreAndRankByHpi(rows);
  const educated = rows.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.educated);
  const specialist = rows.filter((row) => row.hpi >= FAME_TIER_MIN_HPI.specialist);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((row) => educated.includes(row)));
  assert.ok(educated.every((row) => specialist.includes(row)));
});
