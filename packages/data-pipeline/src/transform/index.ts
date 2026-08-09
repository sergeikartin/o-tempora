import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConflictCategory, DiscoveryCategory, Region, ReignPeriod } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { validateEnrichedEventsFile } from "../fetch/fetch-events-enrichment.js";
import { validateEnrichedWarsFile } from "../fetch/fetch-wars-enrichment.js";
import { groupReigns } from "./group-reigns.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagCuratedDiscovery, tagCuratedWar } from "./tag-events.js";
import { rankByFameScore, scoreAndRankByHpi } from "./score.js";

export type TaggedPerson = PantheonPersonRow &
  PantheonPersonTags & { description?: string; wikipediaUrl: string; image?: string; imageAttribution?: string };

export interface TaggedDiscovery {
  id: string;
  label: string;
  article?: string;
  description: string;
  year: number;
  sitelinks: number;
  fameScore: number;
  category: DiscoveryCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
}

export interface TaggedWar {
  id: string;
  label: string;
  article?: string;
  description?: string;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
  sitelinks: number;
  fameScore: number;
  category: ConflictCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
  parentId?: string;
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
// transformDiscoveries, and transformWars (both the curated row's own QID)
// — see that file's header comment for why this is a distinct raw file
// rather than folded into the enrichment passes above.
function loadImageAttributionFile(): ImageAttributionFile {
  const raw = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "image-attribution.raw.json"), "utf8"),
  ) as ImageAttributionFile;
  return { people: raw.people ?? {}, discoveries: raw.discoveries ?? {}, wars: raw.wars ?? {} };
}

interface PageviewsFile {
  wars: Record<string, number>;
  discoveries: Record<string, number>;
}

// fetch-pageviews.ts's output — trailing-4-year, 7-language-basket pageview
// totals keyed by the same curated id as transformWars/transformDiscoveries,
// same "separate raw file, same loading convention" reasoning as
// loadImageAttributionFile above. A missing id (fetch-pageviews.ts skipped
// it, or the whole stage failed) coerces to 0 pageviews at the call site,
// not here — score.ts's blend formula degrades gracefully to a
// sitelinks-only score for that row (ADR 0010).
function loadPageviewsFile(): PageviewsFile {
  const raw = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "pageviews.raw.json"), "utf8"),
  ) as PageviewsFile;
  return { wars: raw.wars ?? {}, discoveries: raw.discoveries ?? {} };
}

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

// Sourced from the hand-curated + enriched wars list
// (fetch-wars-enrichment.ts's output), not a raw SPARQL binding dump —
// already one row per conflict, so no groupRows step needed here (same
// reasoning as transformPeople/transformDiscoveries). A missing enriched
// `sitelinks` means the enrichment pass couldn't resolve that QID; coerced
// to 0 here so it sorts last and Output's buildWars can drop it explicitly
// (same convention transformDiscoveries uses). Unlike Discoveries,
// description/year/endYear are also enrichment-sourced here, not
// curator-authored — left `undefined` rather than coerced when the
// enrichment pass didn't resolve them, since buildWars needs to
// distinguish "no date at all" (drop) from "one date" (WarEvent) from "two
// dates" (War).
export function transformWars(): TaggedWar[] {
  const enrichedPath = path.join(RAW_DIR, "wars-curated-enriched.raw.json");
  const { wars } = validateEnrichedWarsFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadImageAttributionFile().wars;
  const pageviews = loadPageviewsFile().wars;

  const tagged = wars.map((war) => {
    const { category, regionTags } = tagCuratedWar(war.category, war.countries);
    return {
      id: war.id,
      label: war.name,
      article: war.wikipediaUrl,
      description: war.description,
      year: war.year,
      month: war.month,
      endYear: war.endYear,
      endMonth: war.endMonth,
      sitelinks: war.sitelinks ?? 0,
      pageviews: pageviews[war.id] ?? 0,
      category,
      regionTags,
      image: war.image,
      imageAttribution: imageAttribution[war.id],
      parentId: war.parentId,
    };
  });

  return rankByFameScore(tagged);
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
  const pageviews = loadPageviewsFile().discoveries;

  const tagged = events.map((event) => {
    const { category, regionTags } = tagCuratedDiscovery(event.category, event.countries);
    return {
      id: event.id,
      label: event.name,
      article: event.wikipediaUrl,
      description: event.description,
      year: event.year,
      sitelinks: event.sitelinks ?? 0,
      pageviews: pageviews[event.id] ?? 0,
      category,
      regionTags,
      image: event.image,
      imageAttribution: imageAttribution[event.id],
    };
  });

  return rankByFameScore(tagged);
}

// Keyed by every person Q-ID that fetch-reigns.ts's snapshot covers, not
// just the ones that survive the fame-tier cut in transformPeople() —
// Output looks this up by id per final person, so extra/stale entries are
// simply never read.
export function loadReignsMap(): Map<string, ReignPeriod[]> {
  const raw = loadRaw("people-reigns.raw.json");
  return groupReigns(raw.results.bindings);
}
