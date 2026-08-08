import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaggedPerson, TaggedEvent, TaggedDiscovery } from "../transform/index.js";
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

function taggedEvent(overrides: Partial<TaggedEvent> = {}): TaggedEvent {
  return {
    id: "Q2",
    label: "Battle of Marathon",
    sitelinks: 80,
    article: "https://en.wikipedia.org/wiki/Battle_of_Marathon",
    description: "490 BCE battle",
    year: -490,
    tags: ["Q178561"],
    countries: [],
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

test("buildWars builds a War (with period.end) for the war type (Q198), even if secondaryYear is present", () => {
  const war = taggedEvent({ id: "Q3", tags: ["Q198"], year: 1861, secondaryYear: 1865 });
  const battle = taggedEvent({ id: "Q4", tags: ["Q178561"], year: 1863, secondaryYear: 1863 });

  const { entries } = buildWars([war, battle]);

  const [warEntry, battleEntry] = entries;
  assert.ok(warEntry && "period" in warEntry);
  assert.deepEqual(warEntry.period, { start: { year: 1861 }, end: { year: 1865 } });
  assert.ok(battleEntry && "at" in battleEntry);
  assert.deepEqual(battleEntry.at, { year: 1863 });
});

test("buildWars also builds a War for the war-of-independence type (Q1006311), alongside war", () => {
  const warOfIndependence = taggedEvent({
    id: "Q5",
    tags: ["Q1006311"],
    year: 1775,
    secondaryYear: 1783,
    category: "war-of-independence",
  });

  const { entries } = buildWars([warOfIndependence]);

  const [entry] = entries;
  assert.ok(entry && "period" in entry);
  assert.deepEqual(entry.period, { start: { year: 1775 }, end: { year: 1783 } });
});

test("buildWars passes through image/imageAttribution when present", () => {
  const { entries } = buildWars([
    taggedEvent({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg", imageAttribution: "W, via Wikimedia Commons" }),
  ]);
  assert.equal(entries[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg");
  assert.equal(entries[0]?.imageAttribution, "W, via Wikimedia Commons");
});

test("buildWars omits image/imageAttribution entirely (not undefined-valued keys) when absent", () => {
  const { entries } = buildWars([taggedEvent({ image: undefined, imageAttribution: undefined })]);
  assert.equal("image" in (entries[0] as object), false);
  assert.equal("imageAttribution" in (entries[0] as object), false);
});

test("buildWars carries month through to period.start/end and at when the row has one", () => {
  const war = taggedEvent({ id: "Q3", tags: ["Q198"], year: 1950, month: 6, secondaryYear: 1953, secondaryMonth: 7 });
  const battle = taggedEvent({ id: "Q4", tags: ["Q178561"], year: 1863, month: 7 });

  const { entries } = buildWars([war, battle]);

  const [warEntry, battleEntry] = entries;
  assert.ok(warEntry && "period" in warEntry);
  assert.deepEqual(warEntry.period, { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } });
  assert.ok(battleEntry && "at" in battleEntry);
  assert.deepEqual(battleEntry.at, { year: 1863, month: 7 });
});

test("buildDiscoveries passes through category, regionTags, and at.year", () => {
  const { discoveries } = buildDiscoveries([taggedDiscovery()]);

  assert.deepEqual(discoveries[0], {
    id: "Q5",
    name: "Penicillin",
    at: { year: 1928 },
    category: "medicine-health",
    regionTags: ["europe"],
    fameScore: 80,
    description: "1928 discovery of the antibiotic",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
  });
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
