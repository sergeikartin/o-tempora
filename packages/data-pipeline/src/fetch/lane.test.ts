import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLaneFlag } from './lane.ts';

test("parseLaneFlag returns undefined when --lane is absent (today's unchanged 'run all three' default)", () => {
  assert.equal(parseLaneFlag([]), undefined);
});

test('parseLaneFlag returns the requested lane', () => {
  assert.equal(parseLaneFlag(['--lane=milestones']), 'milestones');
});

test('parseLaneFlag throws with the valid values listed, for an unrecognized --lane value', () => {
  assert.throws(
    () => parseLaneFlag(['--lane=events']),
    /Invalid --lane value "events".*people, conflicts, milestones/,
  );
});
