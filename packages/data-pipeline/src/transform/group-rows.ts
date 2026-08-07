import type { SparqlBinding } from "../fetch/sparql-result-shape.js";
import { parseIsoYear, parseMonthIfKnown } from "./wikidata-date.js";

// One row per entity, collapsed from the denormalized SPARQL results (a
// person/event with N occupation/type/country claims arrives as N rows
// sharing the same entity URI). Shared by Score and Tag for all three raw
// sources (people, historical events, inventions) via GroupRowsConfig, since
// neither can operate on raw denormalized rows.
export interface GroupedRow {
  id: string;
  label?: string;
  sitelinks: number;
  article?: string;
  description?: string;
  year?: number;
  month?: number;
  secondaryYear?: number;
  secondaryMonth?: number;
  tags: string[];
  countries: string[];
  partOfLabel?: string;
}

export interface GroupRowsConfig {
  entityVar: string;
  labelVar: string;
  sitelinksVar: string;
  articleVar: string;
  descriptionVar: string;
  dateVar: string;
  // Wikidata's wikibase:timePrecision for dateVar's statement (11 = day,
  // 10 = month, 9 = year, <9 coarser) — bound from the statement's value
  // node (psv:/pqv:), not derivable from the wdt:/pq: truthy date value
  // alone, since Wikidata always canonicalizes an unknown month/day to
  // "01" rather than leaving it absent. Optional: a caller with no
  // precision binding simply never gets a month (see parseMonthIfKnown).
  datePrecisionVar?: string;
  secondaryDateVar?: string;
  secondaryDatePrecisionVar?: string;
  tagVar?: string;
  countryVar: string;
  partOfLabelVar?: string;
}

// Only accepts real https://www.wikidata.org/entity/Q... URIs. Wikidata's RDF
// mapping represents a "some value" claim (a claim known to exist but not
// stated) as a skolemized blank node under /.well-known/genid/... — still
// SPARQL type "uri", but not an entity reference, so it must be filtered out
// here rather than collected as a bogus Q-ID.
const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

export function groupRows(bindings: SparqlBinding[], config: GroupRowsConfig): GroupedRow[] {
  const grouped = new Map<string, GroupedRow>();

  for (const row of bindings) {
    const entityValue = row[config.entityVar]?.value;
    if (!entityValue) continue;
    const id = extractQid(entityValue);
    if (!id) continue;

    let entry = grouped.get(id);
    if (!entry) {
      entry = { id, sitelinks: 0, tags: [], countries: [] };
      grouped.set(id, entry);
    }

    if (entry.label === undefined) entry.label = row[config.labelVar]?.value;
    if (entry.article === undefined) entry.article = row[config.articleVar]?.value;
    if (entry.description === undefined) entry.description = row[config.descriptionVar]?.value;

    if (entry.year === undefined) {
      const dateValue = row[config.dateVar]?.value;
      if (dateValue) {
        entry.year = parseIsoYear(dateValue);
        const precisionValue = config.datePrecisionVar ? row[config.datePrecisionVar]?.value : undefined;
        entry.month = parseMonthIfKnown(dateValue, precisionValue);
      }
    }
    if (config.secondaryDateVar && entry.secondaryYear === undefined) {
      const dateValue = row[config.secondaryDateVar]?.value;
      if (dateValue) {
        entry.secondaryYear = parseIsoYear(dateValue);
        const precisionValue = config.secondaryDatePrecisionVar
          ? row[config.secondaryDatePrecisionVar]?.value
          : undefined;
        entry.secondaryMonth = parseMonthIfKnown(dateValue, precisionValue);
      }
    }

    const sitelinksValue = row[config.sitelinksVar]?.value;
    if (sitelinksValue) entry.sitelinks = Number(sitelinksValue);

    if (config.tagVar) {
      const tagValue = row[config.tagVar]?.value;
      const tagId = tagValue ? extractQid(tagValue) : undefined;
      if (tagId && !entry.tags.includes(tagId)) entry.tags.push(tagId);
    }

    const countryValue = row[config.countryVar]?.value;
    const countryId = countryValue ? extractQid(countryValue) : undefined;
    if (countryId && !entry.countries.includes(countryId)) entry.countries.push(countryId);

    if (config.partOfLabelVar && entry.partOfLabel === undefined) {
      const partOfLabelValue = row[config.partOfLabelVar]?.value;
      if (partOfLabelValue) entry.partOfLabel = partOfLabelValue;
    }
  }

  return [...grouped.values()];
}
