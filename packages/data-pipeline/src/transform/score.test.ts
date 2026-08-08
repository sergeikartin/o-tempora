import { test } from "node:test";
import assert from "node:assert/strict";
import type { ConflictCategory } from "@same-sky/shared-types";
import { CONFLICT_CATEGORIES } from "@same-sky/shared-types";
import {
  scoreAndRank,
  rankDiscoveriesBySitelinks,
  scoreAndRankByHpi,
  FAME_TIER_SITELINKS_WARS,
  FAME_TIER_MIN_HPI,
} from "./score.js";

function row(sitelinks: number, category: ConflictCategory = "war") {
  return { sitelinks, category };
}

test("drops rows below their category's specialist floor", () => {
  const rows = [row(69), row(70), row(5)];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((r) => r.sitelinks),
    [70],
  );
});

test("drops a row with no mappable category, regardless of sitelinks", () => {
  const rows: Array<{ sitelinks: number; category?: ConflictCategory }> = [{ sitelinks: 500 }];
  assert.deepEqual(scoreAndRank(rows), []);
});

test("sorts remaining rows descending by sitelinks", () => {
  const rows = [row(100), row(500), row(200)];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((r) => r.sitelinks),
    [500, 200, 100],
  );
});

test("applies each row's own category's floor (still flat across all 9 categories today)", () => {
  const rows: Array<{ sitelinks: number; category: ConflictCategory }> = [
    { sitelinks: 70, category: "war" },
    { sitelinks: 70, category: "peace-treaty" },
    { sitelinks: 69, category: "battle" },
  ];
  const result = scoreAndRank(rows);
  assert.deepEqual(
    result.map((r) => r.category),
    ["war", "peace-treaty"],
  );
});

test("FAME_TIER_SITELINKS_WARS has one entry per ConflictCategory value", () => {
  assert.deepEqual(Object.keys(FAME_TIER_SITELINKS_WARS).sort(), [...CONFLICT_CATEGORIES].sort());
});

test("FAME_TIER_SITELINKS_WARS gives each category its own object, not a shared reference — mutating one category's floor must not affect another's", () => {
  assert.notEqual(FAME_TIER_SITELINKS_WARS.war, FAME_TIER_SITELINKS_WARS.battle);
  const original = FAME_TIER_SITELINKS_WARS["peace-treaty"].specialist;
  FAME_TIER_SITELINKS_WARS["peace-treaty"].specialist = 999;
  assert.notEqual(FAME_TIER_SITELINKS_WARS.war.specialist, 999);
  FAME_TIER_SITELINKS_WARS["peace-treaty"].specialist = original;
});

test("tier nesting holds: specialist output is a strict superset of what generalPublic/educated would allow", () => {
  const rows = [row(70), row(89), row(90), row(99), row(100), row(200)];
  const specialist = scoreAndRank(rows);
  const generalPublic = rows.filter((r) => r.sitelinks >= FAME_TIER_SITELINKS_WARS.war.generalPublic);
  const educated = rows.filter((r) => r.sitelinks >= FAME_TIER_SITELINKS_WARS.war.educated);

  assert.equal(generalPublic.length, 2);
  assert.equal(educated.length, 4);
  assert.equal(specialist.length, 6);
  assert.ok(generalPublic.every((r) => educated.includes(r)));
  assert.ok(educated.every((r) => specialist.includes(r)));
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
