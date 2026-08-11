import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLaneFlag } from "./lane.js";

test("parseLaneFlag returns undefined when --lane is absent (today's unchanged 'run all three' default)", () => {
  assert.equal(parseLaneFlag([]), undefined);
});

test("parseLaneFlag returns the requested lane", () => {
  assert.equal(parseLaneFlag(["--lane=discoveries"]), "discoveries");
});

test("parseLaneFlag throws with the valid values listed, for an unrecognized --lane value", () => {
  assert.throws(() => parseLaneFlag(["--lane=events"]), /Invalid --lane value "events".*people, wars, discoveries/);
});
