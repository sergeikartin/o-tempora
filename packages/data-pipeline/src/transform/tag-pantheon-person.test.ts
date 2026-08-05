import { test } from "node:test";
import assert from "node:assert/strict";
import type { PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { tagPantheonPerson } from "./tag-pantheon-person.js";

function pantheonRow(overrides: Partial<PantheonPersonRow> = {}): PantheonPersonRow {
  return {
    id: "14627",
    wdId: "Q935",
    name: "Isaac Newton",
    slug: "Isaac_Newton",
    occupation: "PHYSICIST",
    hpi: 99.44,
    bplaceCountry: "United Kingdom",
    dplaceCountry: "United Kingdom",
    birthyear: 1643,
    deathyear: 1726,
    ...overrides,
  };
}

test("maps a known occupation to its domain", () => {
  const { occupationDomain } = tagPantheonPerson(pantheonRow({ occupation: "SOCCER PLAYER" }));
  assert.equal(occupationDomain, "sports");
});

test("leaves occupationDomain undefined for an empty occupation", () => {
  const { occupationDomain } = tagPantheonPerson(pantheonRow({ occupation: "" }));
  assert.equal(occupationDomain, undefined);
});

test("leaves occupationDomain undefined for an unmapped occupation value", () => {
  const { occupationDomain } = tagPantheonPerson(pantheonRow({ occupation: "NOT A REAL OCCUPATION" }));
  assert.equal(occupationDomain, undefined);
});

test("dedupes region tags when birth and death country are the same", () => {
  const { regionTags } = tagPantheonPerson(
    pantheonRow({ bplaceCountry: "United Kingdom", dplaceCountry: "United Kingdom" }),
  );
  assert.deepEqual(regionTags, ["northern-europe"]);
});

test("tags both birth and death region when they differ", () => {
  const { regionTags } = tagPantheonPerson(pantheonRow({ bplaceCountry: "Italy", dplaceCountry: "Japan" }));
  assert.deepEqual(regionTags, ["southern-europe", "eastern-asia"]);
});

test("handles a known person-CSV country-name alias not in the API's canonical form", () => {
  const { regionTags } = tagPantheonPerson(
    pantheonRow({ bplaceCountry: "Bahamas, The", dplaceCountry: "Bahamas, The" }),
  );
  assert.deepEqual(regionTags, ["caribbean"]);
});

test("leaves regionTags empty for an unmapped or missing country", () => {
  const { regionTags } = tagPantheonPerson(pantheonRow({ bplaceCountry: "", dplaceCountry: "Antarctica" }));
  assert.deepEqual(regionTags, []);
});
