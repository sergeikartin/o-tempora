import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConflictCategory, MilestoneCategory, Region } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { validateEnrichedMilestonesFile } from "../fetch/fetch-milestones-enrichment.js";
import { validateEnrichedConflictsFile } from "../fetch/fetch-conflicts-enrichment.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagCuratedMilestone, tagCuratedConflict } from "./tag-milestones.js";
import { rankByFameScore, scoreAndRankByHpi } from "./score.js";

export type TaggedPerson = PantheonPersonRow &
  PantheonPersonTags & {
    tagline?: string;
    // Wikipedia lead-paragraph extract (fetch-wikipedia-extracts.ts's
    // output) — independent of tagline, never a fallback for it. Absent
    // never drops the row (only a missing tagline does).
    description?: string;
    wikipediaUrl: string;
    image?: string;
    imageAttribution?: string;
  };

export interface TaggedMilestone {
  id: string;
  label: string;
  article?: string;
  // Absent means the live enrichment pass couldn't resolve an English
  // tagline for this curated QID — Output drops the row (no fallback to
  // the curated file's old hand-typed text), the same "no fallback, drop
  // instead" behavior Conflicts/People already have.
  tagline?: string;
  description?: string;
  year?: number;
  month?: number;
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
  article?: string;
  tagline?: string;
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
  tagline?: string;
  image?: string;
}

// Keyed by Wikidata QID, extracted from the tagline-query's ?person
// URI binding. Also carries the P18 image URI the same query now backfills (this ticket's
// query change). tagline is single-valued (a FILTER(LANG=en) claim),
// but P18 is not — a person with more than one English-Wikidata image
// claim produces multiple binding rows for the same ?person, so this keeps
// only the first image seen per person (first-wins, same convention
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
      tagline: existing?.tagline ?? row.tagline?.value,
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
// Taglines come from a separate batched SPARQL fetch keyed on the
// Wikidata QID Pantheon retains per row (fetch-taglines.ts), since
// Pantheon's own CSV has no tagline-equivalent field.
export function transformPeople(): TaggedPerson[] {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(fs.readFileSync(csvPath, "utf8"));
  const enrichment = loadPeopleEnrichmentMap();
  const imageAttribution = loadRawRecord<string>("people-image-attribution.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("people-wikipedia-extracts.raw.json");

  const tagged = rows.map((row) => ({
    ...row,
    ...tagPantheonPerson(row),
    tagline: enrichment.get(row.wdId)?.tagline,
    description: wikipediaExtracts[row.wdId],
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
// (same convention transformMilestones uses). Unlike Milestones,
// tagline/year/endYear are also enrichment-sourced here, not
// curator-authored — left `undefined` rather than coerced when the
// enrichment pass didn't resolve them, since buildConflicts needs to
// distinguish "no date at all" (drop) from "one date" (ConflictEvent) from "two
// dates" (Conflict).
export function transformConflicts(): TaggedConflict[] {
  const enrichedPath = path.join(RAW_DIR, "conflicts-curated-enriched.raw.json");
  const { conflicts } = validateEnrichedConflictsFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadRawRecord<string>("conflicts-image-attribution.raw.json");
  const pageviews = loadRawRecord<number>("conflicts-pageviews.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("conflicts-wikipedia-extracts.raw.json");

  const tagged = conflicts.map((conflict) => {
    const { category, regionTags } = tagCuratedConflict(conflict.category, conflict.countries);
    return {
      id: conflict.id,
      label: conflict.name,
      article: conflict.wikipediaUrl,
      tagline: conflict.tagline,
      description: wikipediaExtracts[conflict.id],
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
export function transformMilestones(): TaggedMilestone[] {
  const enrichedPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  const { milestones } = validateEnrichedMilestonesFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));
  const imageAttribution = loadRawRecord<string>("milestones-image-attribution.raw.json");
  const pageviews = loadRawRecord<number>("milestones-pageviews.raw.json");
  const wikipediaExtracts = loadRawRecord<string>("milestones-wikipedia-extracts.raw.json");

  const tagged = milestones.map((milestone) => {
    const { category, regionTags } = tagCuratedMilestone(milestone.category, milestone.countries);
    return {
      id: milestone.id,
      label: milestone.name,
      article: milestone.wikipediaUrl,
      tagline: milestone.tagline,
      description: wikipediaExtracts[milestone.id],
      year: milestone.year,
      month: milestone.month,
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
