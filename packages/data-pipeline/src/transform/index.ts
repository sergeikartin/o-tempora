import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConflictCategory, MilestoneCategory, Region } from "@o-tempora/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { validateEnrichedMilestonesFile } from "../fetch/fetch-milestones-enrichment.js";
import { validateEnrichedConflictsFile } from "../fetch/fetch-conflicts-enrichment.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagCuratedMilestone, tagCuratedConflict } from "./tag-milestones.js";
import { rankByFameScore, scoreAndRankByHpi } from "./score.js";

// Omits PantheonPersonRow's own `name` — Output no longer reads it
// (name is now sourced from the Wikidata label enrichment pass below, the
// same symmetric per-language mechanism Conflicts/Milestones use), so this
// redeclares it as the enrichment-sourced, possibly-absent field rather
// than inheriting Pantheon's always-present one.
export type TaggedPerson = Omit<PantheonPersonRow, "name"> &
  PantheonPersonTags & {
    // Wikidata's rdfs:label(en) for this person's Wikidata QID — absent
    // only when the enrichment pass couldn't resolve one; Output drops the
    // row when this is missing (see write-datasets.ts's buildPeople).
    name?: string;
    // Wikidata's rdfs:label(ru) — absent whenever no Russian label
    // resolves. Output falls back to `name` (English) per field, at output
    // time, when building the Russian dataset file.
    nameRu?: string;
    tagline?: string;
    // Russian schema:description binding, same fallback-at-output-time
    // contract as nameRu above.
    taglineRu?: string;
    // Wikipedia lead-paragraph extract (fetch-wikipedia-extracts.ts's
    // output) — independent of tagline, never a fallback for it. Absent
    // never drops the row (only a missing tagline does).
    description?: string;
    // ru.wikipedia.org's own lead-paragraph extract for the same entity —
    // absent whenever no Russian article resolves (materially more often
    // than English, expected). Output falls back to `description`
    // (English) at output time, when building the Russian dataset file,
    // the same per-field fallback contract as name/tagline.
    descriptionRu?: string;
    wikipediaUrl: string;
    image?: string;
    imageAttribution?: string;
  };

export interface TaggedMilestone {
  id: string;
  label: string;
  // Russian rdfs:label — absent whenever no Russian label resolves; Output
  // falls back to `label` (English) per field when building the Russian
  // dataset file.
  labelRu?: string;
  article?: string;
  // Absent means the live enrichment pass couldn't resolve an English
  // tagline for this curated QID — Output drops the row (no fallback to
  // the curated file's old hand-typed text), the same "no fallback, drop
  // instead" behavior Conflicts/People already have.
  tagline?: string;
  // Russian schema:description binding, same fallback-at-output-time
  // contract as labelRu above.
  taglineRu?: string;
  description?: string;
  // Same fallback-at-output-time contract as taglineRu above.
  descriptionRu?: string;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
  sitelinks: number;
  fameScore: number;
  category: MilestoneCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
}

export interface TaggedConflict {
  id: string;
  label: string;
  // Russian rdfs:label — absent whenever no Russian label resolves; Output
  // falls back to `label` (English) per field when building the Russian
  // dataset file.
  labelRu?: string;
  article?: string;
  tagline?: string;
  // Russian schema:description binding, same fallback-at-output-time
  // contract as labelRu above.
  taglineRu?: string;
  description?: string;
  // Same fallback-at-output-time contract as taglineRu above.
  descriptionRu?: string;
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
  name?: string;
  nameRu?: string;
  tagline?: string;
  taglineRu?: string;
  image?: string;
}

// Keyed by Wikidata QID, extracted from the tagline-query's ?person
// URI binding. Also carries the P18 image URI and an English+Russian
// name/tagline the same query backfills (queries/taglines.ts) — name
// replaces Pantheon's own CSV `name` column as this pipeline's source of
// truth for a person's display name. Every field here is single-valued (a
// FILTER(LANG=..) claim per language) except P18, which isn't — a person
// with more than one English-Wikidata image claim produces multiple
// binding rows for the same ?person, so this keeps only the first value
// seen per person per field (first-wins, same convention
// fetchMilestonesEnrichment's own binding merge uses) rather than letting
// whichever row the endpoint returns last silently overwrite it.
function loadPeopleEnrichmentMap(): Map<string, PersonEnrichment> {
  const raw = loadRaw("people-taglines.raw.json");
  const map = new Map<string, PersonEnrichment>();
  for (const row of raw.results.bindings) {
    const personUri = row.person?.value;
    if (!personUri) continue;
    const match = ENTITY_URI_PATTERN.exec(personUri);
    if (!match?.[1]) continue;
    const id = match[1];
    const existing = map.get(id);
    map.set(id, {
      name: existing?.name ?? row.nameEn?.value,
      nameRu: existing?.nameRu ?? row.nameRu?.value,
      tagline: existing?.tagline ?? row.tagline?.value,
      taglineRu: existing?.taglineRu ?? row.taglineRu?.value,
      image: existing?.image ?? row.image?.value,
    });
  }
  return map;
}

// fetch-image-attribution.ts/fetch-pageviews.ts/fetch-wikipedia-extracts.ts
// each write one raw file per lane (docs/adr/0012-lane-scoped-fetch.md) —
// keyed by the same ids as loadPeopleEnrichmentMap (Wikidata QID) for
// People, and by the curated row's own id for Conflicts/Milestones. A missing
// id means that stage didn't resolve one for this entity (or the pipeline
// hasn't been re-fetched since it was added): image attribution and
// Wikipedia extract degrade to an absent field, never a dropped row (only
// a missing `tagline` drops); pageviews coerces to 0 at the call site, not
// here — score.ts's blend formula degrades gracefully to a sitelinks-only
// score for that row (ADR 0010).
function loadRawRecord<T>(fileName: string): Record<string, T> {
  return (JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), "utf8")) as Record<string, T> | undefined) ?? {};
}

// group -> tag -> score, per lane. People, Conflicts, and
// Milestones are three entirely independent lanes end to
// end — each fed by its own raw snapshot and scored on its own.
// Sourced from Pantheon 2.0, not Wikidata — no grouping needed (the CSV is
// already one row per person, unlike SPARQL's denormalized bindings).
// name/tagline come from a separate batched SPARQL fetch keyed on the
// Wikidata QID Pantheon retains per row (fetch-taglines.ts/
// queries/taglines.ts) — Pantheon's own CSV `name` column is left unused
// (Pantheon's is a frozen snapshot; Wikidata's rdfs:label reflects the
// entity's current name, and is fetched in both en/ru, the one symmetric
// mechanism all three lanes now share), and Pantheon's CSV has no
// tagline-equivalent field of its own to begin with.
export function transformPeople(): TaggedPerson[] {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(fs.readFileSync(csvPath, "utf8"));
  const enrichment = loadPeopleEnrichmentMap();
  const imageAttribution = loadRawRecord<string>("people-image-attribution.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("people-wikipedia-extracts.raw.json");
  const wikipediaExtractsRu = loadRawRecord<string>("people-wikipedia-extracts.ru.raw.json");

  const tagged = rows.map((row) => ({
    ...row,
    ...tagPantheonPerson(row),
    name: enrichment.get(row.wdId)?.name,
    nameRu: enrichment.get(row.wdId)?.nameRu,
    tagline: enrichment.get(row.wdId)?.tagline,
    taglineRu: enrichment.get(row.wdId)?.taglineRu,
    description: wikipediaExtracts[row.wdId],
    descriptionRu: wikipediaExtractsRu[row.wdId],
    wikipediaUrl: `https://en.wikipedia.org/wiki/${row.slug}`,
    image: enrichment.get(row.wdId)?.image,
    imageAttribution: imageAttribution[row.wdId],
  }));

  return scoreAndRankByHpi(tagged);
}

// Sourced from the hand-curated + enriched conflicts list
// (fetch-conflicts-enrichment.ts's output), not a raw SPARQL binding dump —
// already one row per conflict, so no groupRows step needed here (same
// reasoning as transformPeople/transformMilestones). A missing enriched
// `sitelinks` means the enrichment pass couldn't resolve that QID; coerced
// to 0 here so it sorts last and Output's buildConflicts can drop it explicitly
// (same convention transformMilestones uses). name/tagline/year/endYear are
// all enrichment-sourced here, not curator-authored — left `undefined`
// (label falls back to `""`, matching the existing `!row.label` falsy
// check buildConflicts's validateEventRow already does) rather than
// coerced when the enrichment pass didn't resolve them, since
// buildConflicts needs to distinguish "no date at all" (drop) from "one
// date" (ConflictEvent) from "two dates" (Conflict). Milestones' own
// year/endYear are enrichment-sourced the same way, for the same
// point-vs-period distinction in buildMilestones.
export function transformConflicts(): TaggedConflict[] {
  const enrichedPath = path.join(RAW_DIR, "conflicts-curated-enriched.raw.json");
  const { conflicts } = validateEnrichedConflictsFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadRawRecord<string>("conflicts-image-attribution.raw.json");
  const pageviews = loadRawRecord<number>("conflicts-pageviews.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("conflicts-wikipedia-extracts.raw.json");
  const wikipediaExtractsRu = loadRawRecord<string>("conflicts-wikipedia-extracts.ru.raw.json");

  const tagged = conflicts.map((conflict) => {
    const { category, regionTags } = tagCuratedConflict(conflict.category, conflict.countries);
    return {
      id: conflict.id,
      label: conflict.name ?? "",
      labelRu: conflict.nameRu,
      article: conflict.wikipediaUrl,
      tagline: conflict.tagline,
      taglineRu: conflict.taglineRu,
      description: wikipediaExtracts[conflict.id],
      descriptionRu: wikipediaExtractsRu[conflict.id],
      year: conflict.year,
      month: conflict.month,
      endYear: conflict.endYear,
      endMonth: conflict.endMonth,
      sitelinks: conflict.sitelinks ?? 0,
      pageviews: pageviews[conflict.id] ?? 0,
      category,
      regionTags,
      image: conflict.image,
      imageAttribution: imageAttribution[conflict.id],
      parentId: conflict.parentId,
    };
  });

  return rankByFameScore(tagged);
}

// Sourced from the hand-curated + enriched milestones list
// (fetch-milestones-enrichment.ts's output), not a raw SPARQL binding dump —
// already one row per milestone, so no groupRows step needed here either
// (same reasoning as transformPeople). A missing enriched `sitelinks`
// means the enrichment pass couldn't resolve that QID; coerced to 0 here
// so it sorts last and Output's buildMilestones can drop it explicitly.
// name is enrichment-sourced too, same as Conflicts — label falls back to
// `""` (matching validateEventRow's `!row.label` falsy check) rather than
// coerced when the enrichment pass didn't resolve an English label.
export function transformMilestones(): TaggedMilestone[] {
  const enrichedPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  const { milestones } = validateEnrichedMilestonesFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadRawRecord<string>("milestones-image-attribution.raw.json");
  const pageviews = loadRawRecord<number>("milestones-pageviews.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("milestones-wikipedia-extracts.raw.json");
  const wikipediaExtractsRu = loadRawRecord<string>("milestones-wikipedia-extracts.ru.raw.json");

  const tagged = milestones.map((milestone) => {
    const { category, regionTags } = tagCuratedMilestone(milestone.category, milestone.countries);
    return {
      id: milestone.id,
      label: milestone.name ?? "",
      labelRu: milestone.nameRu,
      article: milestone.wikipediaUrl,
      tagline: milestone.tagline,
      taglineRu: milestone.taglineRu,
      description: wikipediaExtracts[milestone.id],
      descriptionRu: wikipediaExtractsRu[milestone.id],
      year: milestone.year,
      month: milestone.month,
      endYear: milestone.endYear,
      endMonth: milestone.endMonth,
      sitelinks: milestone.sitelinks ?? 0,
      pageviews: pageviews[milestone.id] ?? 0,
      category,
      regionTags,
      image: milestone.image,
      imageAttribution: imageAttribution[milestone.id],
    };
  });

  return rankByFameScore(tagged);
}
