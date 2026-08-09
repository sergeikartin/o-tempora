import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaggedPerson, TaggedWar, TaggedDiscovery } from "../transform/index.js";
import { buildPeople, buildWars, buildDiscoveries } from "./write-datasets.js";

function taggedPerson(overrides: Partial<TaggedPerson> = {}): TaggedPerson {
  return {
    id: "14627",
    wdId: "Q935",
    name: "Ada Lovelace",
    slug: "Ada_Lovelace",
    occupation: "MATHEMATICIAN",
    hpi: 85,
    bplaceCountry: "United Kingdom",
    dplaceCountry: "United Kingdom",
    birthyear: 1815,
    alive: true,
    description: "English mathematician",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Ada_Lovelace",
    occupationDomain: "science-technology",
    regionTags: ["northern-europe"],
    ...overrides,
  };
}

function taggedWar(overrides: Partial<TaggedWar> = {}): TaggedWar {
  return {
    id: "Q2",
    label: "Peloponnesian War",
    sitelinks: 80,
    fameScore: 52,
    article: "https://en.wikipedia.org/wiki/Peloponnesian_War",
    description: "war fought between Athens and Sparta",
    year: -431,
    endYear: -404,
    category: "war",
    regionTags: [],
    ...overrides,
  };
}

function taggedDiscovery(overrides: Partial<TaggedDiscovery> = {}): TaggedDiscovery {
  return {
    id: "Q5",
    label: "Penicillin",
    article: "https://en.wikipedia.org/wiki/Penicillin",
    description: "1928 discovery of the antibiotic",
    year: 1928,
    sitelinks: 80,
    fameScore: 52,
    category: "medicine-health",
    regionTags: ["europe"],
    ...overrides,
  };
}

test("buildPeople attaches reignPeriods only for people present in the map, keyed by wdId", () => {
  const rows = [taggedPerson({ wdId: "Q935" }), taggedPerson({ wdId: "Q9682", name: "Charles II" })];
  const reigns = new Map([["Q9682", [{ start: { year: 1660 }, end: { year: 1685 } }]]]);

  const { people } = buildPeople(rows, reigns);

  const [q935, q9682] = people;
  assert.equal(q935?.reignPeriods, undefined);
  assert.deepEqual(q9682?.reignPeriods, [{ start: { year: 1660 }, end: { year: 1685 } }]);
});

test("buildPeople builds lifespan.start/end from birthyear/deathyear, with month when present", () => {
  const { people } = buildPeople([taggedPerson({ birthyear: 1815, birthmonth: 12, deathyear: 1852, deathmonth: 11 })]);
  assert.deepEqual(people[0]?.lifespan, { start: { year: 1815, month: 12 }, end: { year: 1852, month: 11 } });
});

test("buildPeople leaves lifespan.end undefined (still alive) when deathyear is absent but Pantheon confirms alive", () => {
  const { people } = buildPeople([taggedPerson({ deathyear: undefined, alive: true })]);
  assert.equal(people[0]?.lifespan.end, undefined);
});

// A missing deathyear doesn't always mean "alive" — Pantheon also omits it
// for people whose death date is simply unrecorded (e.g. Jack the Ripper,
// never identified). Only alive:true licenses the "draw through to today"
// contract (see shared-types's Period doc comment); otherwise this is an
// unrepresentable lifespan (not alive, no known end), not "ongoing" — drop it.
test("buildPeople drops a person with no deathyear whom Pantheon doesn't mark alive (unknown death date, not ongoing)", () => {
  const rows = [taggedPerson({ deathyear: undefined, alive: false })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["no deathyear and not confirmed alive"], 1);
});

test("buildPeople defaults to no reign data when no map is passed", () => {
  const { people } = buildPeople([taggedPerson()]);
  assert.equal(people[0]?.reignPeriods, undefined);
});

test("buildPeople drops a person whose birth-to-death span exceeds a plausible human lifespan", () => {
  const rows = [taggedPerson({ id: "347334", birthyear: 2, deathyear: 1912 })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["implausible lifespan"], 1);
});

test("buildPeople drops a person whose death year precedes their birth year", () => {
  const rows = [taggedPerson({ id: "99", birthyear: 1900, deathyear: 1850 })];
  const { people } = buildPeople(rows);
  assert.equal(people.length, 0);
});

test("buildPeople keeps a person with a plausible lifespan, including one near the real-world max", () => {
  const rows = [taggedPerson({ id: "100", birthyear: 1875, deathyear: 1997 })]; // 122 years
  const { people } = buildPeople(rows);
  assert.equal(people.length, 1);
});

test("buildPeople drops a person with no mappable occupation domain", () => {
  const rows = [taggedPerson({ occupationDomain: undefined })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["no mappable occupation domain"], 1);
});

test("buildPeople drops a person with no description", () => {
  const rows = [taggedPerson({ description: undefined })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["missing description"], 1);
});

test("buildPeople maps fameScore directly from hpi", () => {
  const { people } = buildPeople([taggedPerson({ hpi: 92.5 })]);
  assert.equal(people[0]?.fameScore, 92.5);
});

test("buildPeople passes through image/imageAttribution when present", () => {
  const { people } = buildPeople([
    taggedPerson({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg", imageAttribution: "X, via Wikimedia Commons" }),
  ]);
  assert.equal(people[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg");
  assert.equal(people[0]?.imageAttribution, "X, via Wikimedia Commons");
});

test("buildPeople omits image/imageAttribution entirely (not undefined-valued keys) when absent", () => {
  const { people } = buildPeople([taggedPerson({ image: undefined, imageAttribution: undefined })]);
  assert.equal("image" in (people[0] as object), false);
  assert.equal("imageAttribution" in (people[0] as object), false);
});

test("buildWars builds a War (with period.end) when the row resolved both a start and end date, regardless of category", () => {
  const war = taggedWar({ id: "Q3", category: "revolution", year: 1789, endYear: 1799 });
  const { entries } = buildWars([war]);
  const [entry] = entries;
  assert.ok(entry && "period" in entry);
  assert.deepEqual(entry.period, { start: { year: 1789 }, end: { year: 1799 } });
});

test("buildWars builds a WarEvent (with at) when the row resolved only one date, regardless of category", () => {
  const event = taggedWar({ id: "Q4", category: "coup-d-etat", year: 2013, endYear: undefined });
  const { entries } = buildWars([event]);
  const [entry] = entries;
  assert.ok(entry && "at" in entry);
  assert.deepEqual(entry.at, { year: 2013 });
});

test("buildWars drops a row that resolved no date at all", () => {
  const { entries, report } = buildWars([taggedWar({ year: undefined, endYear: undefined })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing date"], 1);
});

test("buildWars drops a row whose sitelinks is 0 (enrichment couldn't resolve the QID)", () => {
  const { entries, report } = buildWars([taggedWar({ sitelinks: 0 })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildWars reads fameScore from the row's already-blended value, not re-derived from sitelinks", () => {
  const { entries } = buildWars([taggedWar({ sitelinks: 200, fameScore: 37 })]);
  assert.equal(entries[0]?.fameScore, 37);
});

test("buildWars drops a row whose sitelinks is 0 even when a nonzero blended fameScore survived (pageviews-only degrade case)", () => {
  const { entries, report } = buildWars([taggedWar({ sitelinks: 0, fameScore: 12 })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildWars passes through image/imageAttribution when present", () => {
  const { entries } = buildWars([
    taggedWar({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg", imageAttribution: "W, via Wikimedia Commons" }),
  ]);
  assert.equal(entries[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg");
  assert.equal(entries[0]?.imageAttribution, "W, via Wikimedia Commons");
});

test("buildWars omits image/imageAttribution entirely (not undefined-valued keys) when absent", () => {
  const { entries } = buildWars([taggedWar({ image: undefined, imageAttribution: undefined })]);
  assert.equal("image" in (entries[0] as object), false);
  assert.equal("imageAttribution" in (entries[0] as object), false);
});

test("buildWars carries month through to period.start/end and at when the row has one", () => {
  const war = taggedWar({ id: "Q3", year: 1950, month: 6, endYear: 1953, endMonth: 7 });
  const event = taggedWar({ id: "Q4", year: 1863, month: 7, endYear: undefined });

  const { entries } = buildWars([war, event]);

  const [warEntry, eventEntry] = entries;
  assert.ok(warEntry && "period" in warEntry);
  assert.deepEqual(warEntry.period, { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } });
  assert.ok(eventEntry && "at" in eventEntry);
  assert.deepEqual(eventEntry.at, { year: 1863, month: 7 });
});

test("buildWars omits parentId entirely when absent (a Container or standalone row)", () => {
  const { entries } = buildWars([taggedWar({ parentId: undefined })]);
  assert.equal("parentId" in (entries[0] as object), false);
});

test("buildWars keeps a valid 2-level chain: a WarEvent parented to a Container", () => {
  const container = taggedWar({ id: "Q1", year: 1095, endYear: 1291 }); // Crusades
  const child = taggedWar({ id: "Q2", year: 1189, endYear: undefined, parentId: "Q1" }); // a single-date sub-event

  const { entries, report } = buildWars([container, child]);

  assert.equal(entries.length, 2);
  assert.equal(Object.keys(report.reasons).length, 0);
  const childEntry = entries.find((entry) => entry.id === "Q2");
  assert.equal(childEntry?.parentId, "Q1");
});

test("buildWars keeps a valid 3-level chain: Container -> level-2 War -> level-3 WarEvent", () => {
  const container = taggedWar({ id: "Q1", year: 1939, endYear: 1945 }); // World War II
  const level2 = taggedWar({ id: "Q2", year: 1941, endYear: 1945, parentId: "Q1" }); // Eastern Front
  const level3 = taggedWar({ id: "Q3", year: 1941, endYear: undefined, parentId: "Q2" }); // a battle within it

  const { entries, report } = buildWars([container, level2, level3]);

  assert.equal(entries.length, 3);
  assert.equal(Object.keys(report.reasons).length, 0);
});

test("buildWars drops a row parented to a nonexistent id", () => {
  const child = taggedWar({ id: "Q2", parentId: "Q999" });
  const { entries, report } = buildWars([child]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["parentId not found"], 1);
});

test("buildWars drops a row parented to a WarEvent (event-parented-to-event)", () => {
  const parentEvent = taggedWar({ id: "Q1", year: 2013, endYear: undefined }); // WarEvent, no children allowed
  const child = taggedWar({ id: "Q2", year: 2013, endYear: undefined, parentId: "Q1" });

  const { entries, report } = buildWars([parentEvent, child]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, "Q1");
  assert.equal(report.reasons["parentId is not a War"], 1);
});

test("buildWars drops a chain exceeding 3 levels deep", () => {
  const container = taggedWar({ id: "Q1", year: 1, endYear: 2 });
  const level2 = taggedWar({ id: "Q2", year: 1, endYear: 2, parentId: "Q1" });
  const level3 = taggedWar({ id: "Q3", year: 1, endYear: 2, parentId: "Q2" }); // a War, so it can itself be a parent
  const level4 = taggedWar({ id: "Q4", year: 1, endYear: undefined, parentId: "Q3" });

  const { entries, report } = buildWars([container, level2, level3, level4]);

  assert.equal(entries.length, 3);
  assert.ok(!entries.some((entry) => entry.id === "Q4"));
  assert.equal(report.reasons["nesting depth exceeded"], 1);
});

test("buildDiscoveries passes through category, regionTags, and at.year", () => {
  const { discoveries } = buildDiscoveries([taggedDiscovery()]);

  assert.deepEqual(discoveries[0], {
    id: "Q5",
    name: "Penicillin",
    at: { year: 1928 },
    category: "medicine-health",
    regionTags: ["europe"],
    fameScore: 52,
    description: "1928 discovery of the antibiotic",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
  });
});

test("buildDiscoveries reads fameScore from the row's already-blended value, not re-derived from sitelinks", () => {
  const { discoveries } = buildDiscoveries([taggedDiscovery({ sitelinks: 200, fameScore: 37 })]);
  assert.equal(discoveries[0]?.fameScore, 37);
});

test("buildDiscoveries drops a row whose sitelinks is 0 even when a nonzero blended fameScore survived (pageviews-only degrade case)", () => {
  const { discoveries, report } = buildDiscoveries([taggedDiscovery({ sitelinks: 0, fameScore: 12 })]);
  assert.equal(discoveries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildDiscoveries drops a row missing wikipediaUrl (enrichment couldn't resolve an article)", () => {
  const { discoveries, report } = buildDiscoveries([taggedDiscovery({ article: undefined })]);
  assert.equal(discoveries.length, 0);
  assert.equal(report.reasons["missing Wikipedia article"], 1);
});

test("buildDiscoveries drops a row whose sitelinks is 0 (enrichment couldn't resolve the QID)", () => {
  const { discoveries, report } = buildDiscoveries([taggedDiscovery({ sitelinks: 0 })]);
  assert.equal(discoveries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildDiscoveries passes through image/imageAttribution when present", () => {
  const { discoveries } = buildDiscoveries([
    taggedDiscovery({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/Y.jpg", imageAttribution: "Y, via Wikimedia Commons" }),
  ]);
  assert.equal(discoveries[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/Y.jpg");
  assert.equal(discoveries[0]?.imageAttribution, "Y, via Wikimedia Commons");
});

test("buildDiscoveries omits image/imageAttribution entirely (not undefined-valued keys) when absent — keeps the existing exact-shape test above honest", () => {
  const { discoveries } = buildDiscoveries([taggedDiscovery()]);
  assert.equal("image" in (discoveries[0] as object), false);
  assert.equal("imageAttribution" in (discoveries[0] as object), false);
});
