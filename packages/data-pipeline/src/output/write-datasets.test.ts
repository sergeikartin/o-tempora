import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaggedPerson, TaggedConflict, TaggedMilestone } from "../transform/index.js";
import { buildPeople, buildConflicts, buildMilestones } from "./write-datasets.js";

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
    tagline: "English mathematician",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Ada_Lovelace",
    occupationDomain: "science-technology",
    regionTags: ["northern-europe"],
    ...overrides,
  };
}

function taggedConflict(overrides: Partial<TaggedConflict> = {}): TaggedConflict {
  return {
    id: "Q2",
    label: "Peloponnesian War",
    sitelinks: 80,
    fameScore: 52,
    article: "https://en.wikipedia.org/wiki/Peloponnesian_War",
    tagline: "war fought between Athens and Sparta",
    year: -431,
    endYear: -404,
    category: "war",
    regionTags: [],
    ...overrides,
  };
}

function taggedMilestone(overrides: Partial<TaggedMilestone> = {}): TaggedMilestone {
  return {
    id: "Q5",
    label: "Penicillin",
    article: "https://en.wikipedia.org/wiki/Penicillin",
    tagline: "1928 discovery of the antibiotic",
    year: 1928,
    sitelinks: 80,
    fameScore: 52,
    category: "medicine-health",
    regionTags: ["europe"],
    ...overrides,
  };
}

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

test("buildPeople drops a person with no tagline", () => {
  const rows = [taggedPerson({ tagline: undefined })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["missing tagline"], 1);
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

test("buildPeople drops a person with no name (the Wikidata label enrichment pass couldn't resolve one)", () => {
  const rows = [taggedPerson({ name: undefined })];
  const { people, report } = buildPeople(rows);
  assert.equal(people.length, 0);
  assert.equal(report.reasons["missing name"], 1);
});

test("buildPeople uses the Russian name/tagline when lang is ru and a Russian value resolved, and falls back to English otherwise", () => {
  const ru = buildPeople(
    [taggedPerson({ name: "Ada Lovelace", nameRu: "Ада Лавлейс", tagline: "English mathematician", taglineRu: "английский математик" })],
    "ru",
  );
  assert.equal(ru.people[0]?.name, "Ада Лавлейс");
  assert.equal(ru.people[0]?.tagline, "английский математик");

  const ruFallback = buildPeople([taggedPerson({ nameRu: undefined, taglineRu: undefined })], "ru");
  assert.equal(ruFallback.people[0]?.name, "Ada Lovelace");
  assert.equal(ruFallback.people[0]?.tagline, "English mathematician");
});

test("buildConflicts builds a Conflict (with period.end) when the row resolved both a start and end date, regardless of category", () => {
  const conflict = taggedConflict({ id: "Q3", category: "revolution", year: 1789, endYear: 1799 });
  const { entries } = buildConflicts([conflict]);
  const [entry] = entries;
  assert.ok(entry && "period" in entry);
  assert.deepEqual(entry.period, { start: { year: 1789 }, end: { year: 1799 } });
});

test("buildConflicts builds a ConflictEvent (with at) when the row resolved only one date, regardless of category", () => {
  const event = taggedConflict({ id: "Q4", category: "coup-d-etat", year: 2013, endYear: undefined });
  const { entries } = buildConflicts([event]);
  const [entry] = entries;
  assert.ok(entry && "at" in entry);
  assert.deepEqual(entry.at, { year: 2013 });
});

test("buildConflicts drops a row that resolved no date at all", () => {
  const { entries, report } = buildConflicts([taggedConflict({ year: undefined, endYear: undefined })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing date"], 1);
});

test("buildConflicts drops a row whose sitelinks is 0 (enrichment couldn't resolve the QID)", () => {
  const { entries, report } = buildConflicts([taggedConflict({ sitelinks: 0 })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildConflicts reads fameScore from the row's already-blended value, not re-derived from sitelinks", () => {
  const { entries } = buildConflicts([taggedConflict({ sitelinks: 200, fameScore: 37 })]);
  assert.equal(entries[0]?.fameScore, 37);
});

test("buildConflicts drops a row whose sitelinks is 0 even when a nonzero blended fameScore survived (pageviews-only degrade case)", () => {
  const { entries, report } = buildConflicts([taggedConflict({ sitelinks: 0, fameScore: 12 })]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildConflicts passes through image/imageAttribution when present", () => {
  const { entries } = buildConflicts([
    taggedConflict({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg", imageAttribution: "W, via Wikimedia Commons" }),
  ]);
  assert.equal(entries[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/W.jpg");
  assert.equal(entries[0]?.imageAttribution, "W, via Wikimedia Commons");
});

test("buildConflicts omits image/imageAttribution entirely (not undefined-valued keys) when absent", () => {
  const { entries } = buildConflicts([taggedConflict({ image: undefined, imageAttribution: undefined })]);
  assert.equal("image" in (entries[0] as object), false);
  assert.equal("imageAttribution" in (entries[0] as object), false);
});

test("buildConflicts carries month through to period.start/end and at when the row has one", () => {
  const conflict = taggedConflict({ id: "Q3", year: 1950, month: 6, endYear: 1953, endMonth: 7 });
  const event = taggedConflict({ id: "Q4", year: 1863, month: 7, endYear: undefined });

  const { entries } = buildConflicts([conflict, event]);

  const [conflictEntry, eventEntry] = entries;
  assert.ok(conflictEntry && "period" in conflictEntry);
  assert.deepEqual(conflictEntry.period, { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } });
  assert.ok(eventEntry && "at" in eventEntry);
  assert.deepEqual(eventEntry.at, { year: 1863, month: 7 });
});

test("buildConflicts defaults to English name/tagline when no lang argument is passed", () => {
  const { entries } = buildConflicts([
    taggedConflict({ label: "French Revolution", labelRu: "Великая французская революция", tagline: "revolution in France", taglineRu: "революция во Франции" }),
  ]);
  assert.equal(entries[0]?.name, "French Revolution");
  assert.equal(entries[0]?.tagline, "revolution in France");
});

test("buildConflicts uses the Russian name/tagline when lang is ru and a Russian value resolved", () => {
  const { entries } = buildConflicts(
    [taggedConflict({ label: "French Revolution", labelRu: "Великая французская революция", tagline: "revolution in France", taglineRu: "революция во Франции" })],
    "ru",
  );
  assert.equal(entries[0]?.name, "Великая французская революция");
  assert.equal(entries[0]?.tagline, "революция во Франции");
});

test("buildConflicts falls back to the English name/tagline when lang is ru but no Russian value resolved", () => {
  const { entries } = buildConflicts(
    [taggedConflict({ label: "Peloponnesian War", labelRu: undefined, tagline: "war fought between Athens and Sparta", taglineRu: undefined })],
    "ru",
  );
  assert.equal(entries[0]?.name, "Peloponnesian War");
  assert.equal(entries[0]?.tagline, "war fought between Athens and Sparta");
});

test("buildConflicts uses the Russian description when lang is ru and it resolved, and falls back to English otherwise", () => {
  const ru = buildConflicts(
    [taggedConflict({ description: "A war in Greece.", descriptionRu: "Война в Греции." })],
    "ru",
  );
  assert.equal(ru.entries[0]?.description, "Война в Греции.");

  const ruFallback = buildConflicts(
    [taggedConflict({ description: "A war in Greece.", descriptionRu: undefined })],
    "ru",
  );
  assert.equal(ruFallback.entries[0]?.description, "A war in Greece.");
});

test("buildConflicts includes/drops the same rows regardless of lang — inclusion is gated on English fields only", () => {
  const rows = [
    taggedConflict({ id: "Q1" }),
    taggedConflict({ id: "Q2", label: "", labelRu: "Что-то" }), // missing English name, has Russian — still dropped
  ];
  const en = buildConflicts(rows, "en");
  const ru = buildConflicts(rows, "ru");
  assert.deepEqual(en.entries.map((e) => e.id), ["Q1"]);
  assert.deepEqual(ru.entries.map((e) => e.id), ["Q1"]);
  assert.equal(en.report.reasons["missing name"], 1);
  assert.equal(ru.report.reasons["missing name"], 1);
});

test("buildConflicts omits parentId entirely when absent (a Container or standalone row)", () => {
  const { entries } = buildConflicts([taggedConflict({ parentId: undefined })]);
  assert.equal("parentId" in (entries[0] as object), false);
});

test("buildConflicts keeps a valid 2-level chain: a ConflictEvent parented to a Container", () => {
  const container = taggedConflict({ id: "Q1", year: 1095, endYear: 1291 }); // Crusades
  const child = taggedConflict({ id: "Q2", year: 1189, endYear: undefined, parentId: "Q1" }); // a single-date sub-event

  const { entries, report } = buildConflicts([container, child]);

  assert.equal(entries.length, 2);
  assert.equal(Object.keys(report.reasons).length, 0);
  const childEntry = entries.find((entry) => entry.id === "Q2");
  assert.equal(childEntry?.parentId, "Q1");
});

test("buildConflicts keeps a valid 3-level chain: Container -> level-2 Conflict -> level-3 ConflictEvent", () => {
  const container = taggedConflict({ id: "Q1", year: 1939, endYear: 1945 }); // World War II
  const level2 = taggedConflict({ id: "Q2", year: 1941, endYear: 1945, parentId: "Q1" }); // Eastern Front
  const level3 = taggedConflict({ id: "Q3", year: 1941, endYear: undefined, parentId: "Q2" }); // a battle within it

  const { entries, report } = buildConflicts([container, level2, level3]);

  assert.equal(entries.length, 3);
  assert.equal(Object.keys(report.reasons).length, 0);
});

test("buildConflicts drops a row parented to a nonexistent id", () => {
  const child = taggedConflict({ id: "Q2", parentId: "Q999" });
  const { entries, report } = buildConflicts([child]);
  assert.equal(entries.length, 0);
  assert.equal(report.reasons["parentId not found"], 1);
});

test("buildConflicts drops a row parented to a ConflictEvent (event-parented-to-event)", () => {
  const parentEvent = taggedConflict({ id: "Q1", year: 2013, endYear: undefined }); // ConflictEvent, no children allowed
  const child = taggedConflict({ id: "Q2", year: 2013, endYear: undefined, parentId: "Q1" });

  const { entries, report } = buildConflicts([parentEvent, child]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, "Q1");
  assert.equal(report.reasons["parentId is not a Conflict"], 1);
});

test("buildConflicts drops a chain exceeding 3 levels deep", () => {
  const container = taggedConflict({ id: "Q1", year: 1, endYear: 2 });
  const level2 = taggedConflict({ id: "Q2", year: 1, endYear: 2, parentId: "Q1" });
  const level3 = taggedConflict({ id: "Q3", year: 1, endYear: 2, parentId: "Q2" }); // a Conflict, so it can itself be a parent
  const level4 = taggedConflict({ id: "Q4", year: 1, endYear: undefined, parentId: "Q3" });

  const { entries, report } = buildConflicts([container, level2, level3, level4]);

  assert.equal(entries.length, 3);
  assert.ok(!entries.some((entry) => entry.id === "Q4"));
  assert.equal(report.reasons["nesting depth exceeded"], 1);
});

test("buildMilestones uses the Russian name/tagline when lang is ru and a Russian value resolved, and falls back to English otherwise", () => {
  const ru = buildMilestones(
    [taggedMilestone({ label: "Penicillin", labelRu: "Пенициллин", tagline: "1928 discovery", taglineRu: "открытие 1928 года" })],
    "ru",
  );
  assert.equal(ru.milestones[0]?.name, "Пенициллин");
  assert.equal(ru.milestones[0]?.tagline, "открытие 1928 года");

  const ruFallback = buildMilestones([taggedMilestone({ label: "Penicillin", labelRu: undefined, taglineRu: undefined })], "ru");
  assert.equal(ruFallback.milestones[0]?.name, "Penicillin");
  assert.equal(ruFallback.milestones[0]?.tagline, "1928 discovery of the antibiotic");
});

test("buildMilestones passes through category, regionTags, and at.year", () => {
  const { milestones } = buildMilestones([taggedMilestone()]);

  assert.deepEqual(milestones[0], {
    id: "Q5",
    name: "Penicillin",
    at: { year: 1928 },
    category: "medicine-health",
    regionTags: ["europe"],
    fameScore: 52,
    tagline: "1928 discovery of the antibiotic",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Penicillin",
  });
});

test("buildMilestones drops a row whose live enrichment couldn't resolve a tagline (no fallback to curated text)", () => {
  const { milestones, report } = buildMilestones([taggedMilestone({ tagline: undefined })]);
  assert.equal(milestones.length, 0);
  assert.equal(report.reasons["missing tagline"], 1);
});

test("buildMilestones reads fameScore from the row's already-blended value, not re-derived from sitelinks", () => {
  const { milestones } = buildMilestones([taggedMilestone({ sitelinks: 200, fameScore: 37 })]);
  assert.equal(milestones[0]?.fameScore, 37);
});

test("buildMilestones drops a row whose sitelinks is 0 even when a nonzero blended fameScore survived (pageviews-only degrade case)", () => {
  const { milestones, report } = buildMilestones([taggedMilestone({ sitelinks: 0, fameScore: 12 })]);
  assert.equal(milestones.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildMilestones drops a row missing wikipediaUrl (enrichment couldn't resolve an article)", () => {
  const { milestones, report } = buildMilestones([taggedMilestone({ article: undefined })]);
  assert.equal(milestones.length, 0);
  assert.equal(report.reasons["missing Wikipedia article"], 1);
});

test("buildMilestones drops a row whose sitelinks is 0 (enrichment couldn't resolve the QID)", () => {
  const { milestones, report } = buildMilestones([taggedMilestone({ sitelinks: 0 })]);
  assert.equal(milestones.length, 0);
  assert.equal(report.reasons["missing sitelinks (enrichment failed)"], 1);
});

test("buildMilestones passes through image/imageAttribution when present", () => {
  const { milestones } = buildMilestones([
    taggedMilestone({ image: "https://commons.wikimedia.org/wiki/Special:FilePath/Y.jpg", imageAttribution: "Y, via Wikimedia Commons" }),
  ]);
  assert.equal(milestones[0]?.image, "https://commons.wikimedia.org/wiki/Special:FilePath/Y.jpg");
  assert.equal(milestones[0]?.imageAttribution, "Y, via Wikimedia Commons");
});

test("buildMilestones omits image/imageAttribution entirely (not undefined-valued keys) when absent — keeps the existing exact-shape test above honest", () => {
  const { milestones } = buildMilestones([taggedMilestone()]);
  assert.equal("image" in (milestones[0] as object), false);
  assert.equal("imageAttribution" in (milestones[0] as object), false);
});

test("buildMilestones builds a period-shaped entry when the row has an endYear, and a point-shaped one when it doesn't", () => {
  const period = taggedMilestone({ id: "Q42005", year: 1346, month: 1, endYear: 1353, endMonth: 12 }); // Black Death
  const point = taggedMilestone({ id: "Q5", year: 1928, endYear: undefined }); // Penicillin

  const { milestones } = buildMilestones([period, point]);

  const [periodEntry, pointEntry] = milestones;
  assert.ok(periodEntry && "period" in periodEntry);
  assert.deepEqual(periodEntry.period, { start: { year: 1346, month: 1 }, end: { year: 1353, month: 12 } });
  assert.ok(pointEntry && "at" in pointEntry);
  assert.deepEqual(pointEntry.at, { year: 1928 });
});
