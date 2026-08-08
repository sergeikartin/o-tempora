import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DiscoveryCategory, Region, ReignPeriod } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { validateEnrichedEventsFile } from "../fetch/fetch-events-enrichment.js";
import { CONFLICT_CATEGORY_QUERIES } from "../fetch/queries/historical-events.js";
import { groupRows, type GroupedRow, type GroupRowsConfig } from "./group-rows.js";
import { groupReigns } from "./group-reigns.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagHistoricalEvent, tagCuratedDiscovery, type EventTags } from "./tag-events.js";
import { scoreAndRank, scoreAndRankByHpi, rankDiscoveriesBySitelinks } from "./score.js";

export type TaggedPerson = PantheonPersonRow &
  PantheonPersonTags & { description?: string; wikipediaUrl: string; image?: string; imageAttribution?: string };
export type TaggedEvent = GroupedRow & EventTags & { imageAttribution?: string };

export interface TaggedDiscovery {
  id: string;
  label: string;
  article?: string;
  description: string;
  year: number;
  sitelinks: number;
  category: DiscoveryCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
}

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

function loadRaw(fileName: string) {
  return validateSparqlResultShape(
    JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), "utf8")),
  );
}

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

interface PersonEnrichment {
  description?: string;
  image?: string;
}

// Keyed by Wikidata QID, extracted from the description-query's ?person
// URI binding — same extraction pattern group-reigns.ts already uses. Also
// carries the P18 image URI the same query now backfills (this ticket's
// query change). description is single-valued (a FILTER(LANG=en) claim),
// but P18 is not — a person with more than one English-Wikidata image
// claim produces multiple binding rows for the same ?person, so this keeps
// only the first image seen per person (first-wins, same convention
// fetchEventsEnrichment's own binding merge uses) rather than letting
// whichever row the endpoint returns last silently overwrite it.
function loadPeopleEnrichmentMap(): Map<string, PersonEnrichment> {
  const raw = loadRaw("people-descriptions.raw.json");
  const map = new Map<string, PersonEnrichment>();
  for (const row of raw.results.bindings) {
    const personUri = row.person?.value;
    if (!personUri) continue;
    const match = ENTITY_URI_PATTERN.exec(personUri);
    if (!match?.[1]) continue;
    const id = match[1];
    const existing = map.get(id);
    map.set(id, {
      description: existing?.description ?? row.description?.value,
      image: existing?.image ?? row.image?.value,
    });
  }
  return map;
}

interface ImageAttributionFile {
  people: Record<string, string>;
  discoveries: Record<string, string>;
  wars: Record<string, string>;
}

// fetch-image-attribution.ts's output — a separate Commons `imageinfo` pass
// keyed by the same ids as loadPeopleEnrichmentMap (Wikidata QID),
// transformDiscoveries (the curated event's own QID), and transformWars
// (the Wikidata QID group-rows.ts groups on) — see that file's header
// comment for why this is a distinct raw file rather than folded into the
// enrichment passes above.
function loadImageAttributionFile(): ImageAttributionFile {
  const raw = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "image-attribution.raw.json"), "utf8"),
  ) as ImageAttributionFile;
  return { people: raw.people ?? {}, discoveries: raw.discoveries ?? {}, wars: raw.wars ?? {} };
}

const HISTORICAL_CONFIG: GroupRowsConfig = {
  entityVar: "event",
  labelVar: "eventLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "date",
  datePrecisionVar: "datePrecision",
  secondaryDateVar: "endDate",
  secondaryDatePrecisionVar: "endDatePrecision",
  tagVar: "type",
  countryVar: "country",
  imageVar: "image",
};

// group -> tag -> score, per lane. People, Wars & Conflicts, and
// Discoveries & Inventions are three entirely independent lanes end to
// end — each fed by its own raw snapshot and scored on its own.
// Sourced from Pantheon 2.0, not Wikidata — no grouping needed (the CSV is
// already one row per person, unlike SPARQL's denormalized bindings).
// Descriptions come from a separate batched SPARQL fetch keyed on the
// Wikidata QID Pantheon retains per row (fetch-descriptions.ts), since
// Pantheon's own CSV has no description-equivalent field.
export function transformPeople(): TaggedPerson[] {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(fs.readFileSync(csvPath, "utf8"));
  const enrichment = loadPeopleEnrichmentMap();
  const imageAttribution = loadImageAttributionFile().people;

  const tagged = rows.map((row) => ({
    ...row,
    ...tagPantheonPerson(row),
    description: enrichment.get(row.wdId)?.description,
    wikipediaUrl: `https://en.wikipedia.org/wiki/${row.slug}`,
    image: enrichment.get(row.wdId)?.image,
    imageAttribution: imageAttribution[row.wdId],
  }));

  return scoreAndRankByHpi(tagged);
}

// A Wikidata item can carry more than one instance-of (P31) claim (e.g. the
// 2022 Russo-Ukrainian escalation is classed as both war and military
// operation; the Fall of Constantinople as both battle and siege) — since
// each ConflictCategory now has its own independent query, such an item
// clears more than one category's query and would otherwise appear twice
// in the concatenated pool under two different categories/shapes. Confirmed
// live (5 of 89 specialist-floor items) while spot-checking the first real
// fetch after "Split fetch into per-category queries" landed. Dedupe by id,
// first-occurrence-wins, so exactly one category sticks per entity —
// CONFLICT_CATEGORY_QUERIES' own array order is the tiebreak (war, battle,
// siege, military-operation, revolution, rebellion, coup-d'état,
// war-of-independence, peace-treaty). This is an editorial salience
// ordering for a general-audience history timeline, not strict Wikidata-
// taxonomy specificity — it happened to pick "war" over "military
// operation" and "revolution" over "rebellion" for the 5 real collisions
// found, both defensible; "battle" beating "siege" for the Fall of
// Constantinople is a closer call (many sources lead with "siege"). Treat
// this ordering as a tunable editorial lever, not a derived fact — if a
// specific miscategorization turns out to matter, fix it by reordering
// CONFLICT_CATEGORY_QUERIES (which log-output grouping doesn't care about),
// not by rewriting this function.
export function dedupeFirstById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

// Reads the 9 per-category raw files fetch-historical-events.ts wrote (one
// per surviving ConflictCategory value, per "Split fetch into per-category
// queries"), grouping each independently before concatenating (safe since
// HISTORICAL_CONFIG is identical across all 9) and deduping the
// concatenated pool by id (dedupeFirstById above).
export function transformWars(): TaggedEvent[] {
  const imageAttribution = loadImageAttributionFile().wars;
  const historical = dedupeFirstById(
    CONFLICT_CATEGORY_QUERIES.flatMap(({ rawFileName }) => {
      const raw = loadRaw(rawFileName);
      return groupRows(raw.results.bindings, HISTORICAL_CONFIG);
    }),
  ).map((row) => ({
    ...row,
    ...tagHistoricalEvent(row),
    imageAttribution: imageAttribution[row.id],
  }));
  return scoreAndRank(historical);
}

// Sourced from the hand-curated + enriched events list
// (fetch-events-enrichment.ts's output), not a raw SPARQL binding dump —
// already one row per event, so no groupRows step needed here either
// (same reasoning as transformPeople). A missing enriched `sitelinks`
// means the enrichment pass couldn't resolve that QID; coerced to 0 here
// so it sorts last and Output's buildDiscoveries can drop it explicitly.
export function transformDiscoveries(): TaggedDiscovery[] {
  const enrichedPath = path.join(RAW_DIR, "events-curated-enriched.raw.json");
  const { events } = validateEnrichedEventsFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadImageAttributionFile().discoveries;

  const tagged = events.map((event) => {
    const { category, regionTags } = tagCuratedDiscovery(event.category, event.countries);
    return {
      id: event.id,
      label: event.name,
      article: event.wikipediaUrl,
      description: event.description,
      year: event.year,
      sitelinks: event.sitelinks ?? 0,
      category,
      regionTags,
      image: event.image,
      imageAttribution: imageAttribution[event.id],
    };
  });

  return rankDiscoveriesBySitelinks(tagged);
}

// Keyed by every person Q-ID that fetch-reigns.ts's snapshot covers, not
// just the ones that survive the fame-tier cut in transformPeople() —
// Output looks this up by id per final person, so extra/stale entries are
// simply never read.
export function loadReignsMap(): Map<string, ReignPeriod[]> {
  const raw = loadRaw("people-reigns.raw.json");
  return groupReigns(raw.results.bindings);
}
