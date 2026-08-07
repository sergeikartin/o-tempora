import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreAndRank,
  rankDiscoveriesBySitelinks,
  scoreAndRankByHpi,
  FAME_TIER_MIN_SITELINKS_WARS,
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

test("rankDiscoveriesBySitelinks sorts descending by sitelinks, with no floor", () => {
  const rows = [{ sitelinks: 100 }, { sitelinks: 500 }, { sitelinks: 0 }, { sitelinks: 5 }];
  const result = rankDiscoveriesBySitelinks(rows);
  assert.deepEqual(
    result.map((row) => row.sitelinks),
    [500, 100, 5, 0],
  );
});

test("rankDiscoveriesBySitelinks keeps every row, unlike scoreAndRank's floor filter", () => {
  const rows = [{ sitelinks: 0 }, { sitelinks: 1 }];
  assert.equal(rankDiscoveriesBySitelinks(rows).length, 2);
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
