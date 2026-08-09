import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFameScore, rankByFameScore, scoreAndRankByHpi, FAME_TIER_MIN_HPI } from "./score.js";

test("computeFameScore blends sitelinks and pageviews per ADR 0010's formula", () => {
  const sitelinks = 100;
  const pageviews = 5_000_000;
  const sSitelinks = Math.min(100, (100 * Math.log(1 + sitelinks)) / Math.log(1 + 350));
  const sPageviews = Math.min(100, (100 * Math.log(1 + pageviews)) / Math.log(1 + 200_000_000));
  const expected = Math.round(0.6 * sSitelinks + 0.4 * sPageviews);
  assert.equal(computeFameScore({ sitelinks, pageviews }), expected);
});

test("computeFameScore clamps S_sitelinks at 100 once sitelinks exceeds the 350 benchmark", () => {
  const atBenchmark = computeFameScore({ sitelinks: 350, pageviews: 0 });
  const wayOverBenchmark = computeFameScore({ sitelinks: 10_000_000, pageviews: 0 });
  assert.equal(atBenchmark, 60); // 0.60 * 100 + 0.40 * 0
  assert.equal(wayOverBenchmark, 60);
});

test("computeFameScore clamps S_pageviews at 100 once pageviews exceeds the 200M benchmark", () => {
  const atBenchmark = computeFameScore({ sitelinks: 0, pageviews: 200_000_000 });
  const wayOverBenchmark = computeFameScore({ sitelinks: 0, pageviews: 50_000_000_000 });
  assert.equal(atBenchmark, 40); // 0.60 * 0 + 0.40 * 100
  assert.equal(wayOverBenchmark, 40);
});

test("computeFameScore still produces a valid score from sitelinks alone when pageviews is 0 (fetch failure degrades, doesn't drop)", () => {
  const score = computeFameScore({ sitelinks: 80, pageviews: 0 });
  assert.ok(score > 0);
  assert.ok(Number.isInteger(score));
});

test("computeFameScore is monotonic: higher sitelinks never decreases the score, holding pageviews fixed", () => {
  const low = computeFameScore({ sitelinks: 10, pageviews: 1_000_000 });
  const high = computeFameScore({ sitelinks: 200, pageviews: 1_000_000 });
  assert.ok(high >= low);
});

test("computeFameScore is monotonic: higher pageviews never decreases the score, holding sitelinks fixed", () => {
  const low = computeFameScore({ sitelinks: 100, pageviews: 1_000 });
  const high = computeFameScore({ sitelinks: 100, pageviews: 100_000_000 });
  assert.ok(high >= low);
});

test("rankByFameScore sorts descending by the blended score, with no floor", () => {
  const rows = [
    { sitelinks: 100, pageviews: 0 },
    { sitelinks: 350, pageviews: 200_000_000 },
    { sitelinks: 0, pageviews: 0 },
    { sitelinks: 5, pageviews: 1_000 },
  ];
  const result = rankByFameScore(rows);
  assert.deepEqual(
    result.map((row) => row.fameScore),
    [...result.map((row) => row.fameScore)].sort((a, b) => b - a),
  );
  assert.equal(result[0]?.sitelinks, 350);
});

test("rankByFameScore keeps every row, no floor filter", () => {
  const rows = [
    { sitelinks: 0, pageviews: 0 },
    { sitelinks: 1, pageviews: 0 },
  ];
  assert.equal(rankByFameScore(rows).length, 2);
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
