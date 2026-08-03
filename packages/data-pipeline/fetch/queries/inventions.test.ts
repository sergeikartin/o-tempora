import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventionsQuery } from "./inventions.js";

test("requires sitelinks >= 30", () => {
  const query = buildInventionsQuery(500, 0);
  assert.match(query, /FILTER\(\?sitelinks >= 30\)/);
});
