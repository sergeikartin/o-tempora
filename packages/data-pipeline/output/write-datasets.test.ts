import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaggedPerson, TaggedEvent } from "../transform/index.js";
import { buildPeople, buildEvents } from "./write-datasets.js";

function taggedPerson(overrides: Partial<TaggedPerson> = {}): TaggedPerson {
  return {
    id: "Q1",
    label: "Ada Lovelace",
    sitelinks: 150,
    article: "https://en.wikipedia.org/wiki/Ada_Lovelace",
    description: "English mathematician",
    year: 1815,
    tags: [],
    countries: [],
    category: "science",
    occupationTags: ["science"],
    regionTags: ["europe"],
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

test("buildPeople attaches reignPeriods only for people present in the map", () => {
  const rows = [taggedPerson({ id: "Q1" }), taggedPerson({ id: "Q2", label: "Charles II" })];
  const reigns = new Map([["Q2", [{ startYear: 1660, endYear: 1685 }]]]);

  const { people } = buildPeople(rows, reigns);

  const [q1, q2] = people;
  assert.equal(q1?.reignPeriods, undefined);
  assert.deepEqual(q2?.reignPeriods, [{ startYear: 1660, endYear: 1685 }]);
});

test("buildPeople defaults to no reign data when no map is passed", () => {
  const { people } = buildPeople([taggedPerson()]);
  assert.equal(people[0]?.reignPeriods, undefined);
});

test("buildPeople drops a person whose birth-to-death span exceeds a plausible human lifespan", () => {
  // Real case: Wikidata's own P569 claim for William McMaster Murdoch is
  // year 2 (upstream data error), while deathYear is the correct 1912 —
  // a 1910-year span that would render as an obviously-broken bar.
  const rows = [taggedPerson({ id: "Q347334", year: 2, secondaryYear: 1912 })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["implausible lifespan"], 1);
});

test("buildPeople drops a person whose death year precedes their birth year", () => {
  const rows = [taggedPerson({ id: "Q99", year: 1900, secondaryYear: 1850 })];
  const { people } = buildPeople(rows);
  assert.equal(people.length, 0);
});

test("buildPeople keeps a person with a plausible lifespan, including one near the real-world max", () => {
  const rows = [taggedPerson({ id: "Q100", year: 1875, secondaryYear: 1997 })]; // 122 years
  const { people } = buildPeople(rows);
  assert.equal(people.length, 1);
});

test("buildEvents only sets endDate for the war type (Q198), even if secondaryYear is present", () => {
  const war = taggedEvent({ id: "Q3", tags: ["Q198"], year: 1861, secondaryYear: 1865 });
  const battle = taggedEvent({ id: "Q4", tags: ["Q178561"], year: 1863, secondaryYear: 1863 });

  const { events } = buildEvents([war, battle]);

  const [warEvent, battleEvent] = events;
  assert.equal(warEvent?.endDate, 1865);
  assert.equal(battleEvent?.endDate, undefined);
});

test("buildEvents passes through partOfLabel as partOfWarName when present", () => {
  const battle = taggedEvent({ partOfLabel: "American Civil War" });
  const { events } = buildEvents([battle]);
  assert.equal(events[0]?.partOfWarName, "American Civil War");
});

test("buildEvents leaves partOfWarName undefined when there is no partOfLabel", () => {
  const { events } = buildEvents([taggedEvent()]);
  assert.equal(events[0]?.partOfWarName, undefined);
});
