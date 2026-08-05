import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvLine } from "./csv.js";

test("splits a simple unquoted line on commas", () => {
  assert.deepEqual(parseCsvLine("1,FALSE,570"), ["1", "FALSE", "570"]);
});

test("treats a comma inside a quoted field as part of the field, not a separator", () => {
  // Real Pantheon row: "Bahamas, The"
  assert.deepEqual(parseCsvLine('1,"Bahamas, The",2'), ["1", "Bahamas, The", "2"]);
});

test("unescapes a doubled double-quote inside a quoted field", () => {
  // Real Pantheon row: Joaquín "El Chapo" Guzmán
  assert.deepEqual(parseCsvLine('1,"Joaquín ""El Chapo"" Guzmán",2'), [
    "1",
    'Joaquín "El Chapo" Guzmán',
    "2",
  ]);
});

test("handles a mix of quoted and unquoted fields in the same row", () => {
  assert.deepEqual(parseCsvLine('18934,"Q9458",18934,"Muhammad",0,"M",,FALSE'), [
    "18934",
    "Q9458",
    "18934",
    "Muhammad",
    "0",
    "M",
    "",
    "FALSE",
  ]);
});

test("preserves an empty field as an empty string, not undefined", () => {
  assert.deepEqual(parseCsvLine("1,,3"), ["1", "", "3"]);
});
