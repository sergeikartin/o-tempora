import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQidsFlag } from "./qid-filter.js";

test("parseQidsFlag returns undefined when --qids is absent", () => {
  assert.equal(parseQidsFlag(["--lane=people"]), undefined);
});

test("parseQidsFlag returns the requested QIDs", () => {
  assert.deepEqual([...parseQidsFlag(["--qids=Q1, Q42"])!], ["Q1", "Q42"]);
});

test("parseQidsFlag throws on a malformed or empty value", () => {
  assert.throws(() => parseQidsFlag(["--qids=Q1,foo"]), /Invalid --qids value "foo"/);
  assert.throws(() => parseQidsFlag(["--qids="]), /at least one QID/);
});
