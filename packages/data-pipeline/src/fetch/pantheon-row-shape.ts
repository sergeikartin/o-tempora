import { parseCsvLine } from "./csv.js";

// Only the columns this pipeline actually consumes — Pantheon's 2025
// Person Dataset has 34 columns total (id, wd_id, wp_id, slug, name,
// occupation, prob_ratio, gender, twitter, alive, l, hpi_raw, bplace_name,
// bplace_lat, bplace_lon, bplace_geonameid, bplace_country, birthdate,
// birthyear, dplace_name, dplace_lat, dplace_lon, dplace_geonameid,
// dplace_country, deathdate, deathyear, bplace_geacron_name,
// dplace_geacron_name, is_group, l_, age, non_en_page_views,
// coefficient_of_variation, hpi); the rest are unused (raw date strings,
// coordinates, GeoNames IDs, HPI's individual components) — see
// .scratch/alt-data-sources/research/pantheon-schema.md for the full field
// list and provenance.
export interface PantheonPersonRow {
  id: string;
  wdId: string;
  name: string;
  // Wikipedia article slug — the closest thing Pantheon has to a
  // Wikipedia link column; wikipediaUrl is built from this
  // (https://en.wikipedia.org/wiki/{slug}) rather than a dedicated URL
  // field, which doesn't exist in this CSV.
  slug: string;
  // Empty string for the 62 rows with no occupation claim at all.
  occupation: string;
  hpi: number;
  // Empty string when unknown — present-day country of the birth/death
  // coordinates, not historical nationality (Pantheon's own FAQ is
  // explicit about this).
  bplaceCountry: string;
  dplaceCountry: string;
  birthyear?: number;
  deathyear?: number;
}

const EXPECTED_HEADER = [
  "id",
  "wd_id",
  "wp_id",
  "slug",
  "name",
  "occupation",
  "prob_ratio",
  "gender",
  "twitter",
  "alive",
  "l",
  "hpi_raw",
  "bplace_name",
  "bplace_lat",
  "bplace_lon",
  "bplace_geonameid",
  "bplace_country",
  "birthdate",
  "birthyear",
  "dplace_name",
  "dplace_lat",
  "dplace_lon",
  "dplace_geonameid",
  "dplace_country",
  "deathdate",
  "deathyear",
  "bplace_geacron_name",
  "dplace_geacron_name",
  "is_group",
  "l_",
  "age",
  "non_en_page_views",
  "coefficient_of_variation",
  "hpi",
];

function parseOptionalInt(value: string): number | undefined {
  return value === "" ? undefined : Number.parseInt(value, 10);
}

/**
 * Structural check on the Pantheon CSV shape only — confirms the header
 * matches what this pipeline was built against and that every row has a
 * parseable id/wd_id/name/hpi. This does not interpret occupation/country
 * values or drop incomplete rows — that boundary belongs to Transform/
 * Output, matching how validate-sparql-result.ts only checks structure.
 */
export function parsePantheonCsv(csvText: string): PantheonPersonRow[] {
  const lines = csvText.split("\n").filter((line) => line.length > 0);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    throw new Error("Pantheon CSV is empty.");
  }

  const header = parseCsvLine(headerLine);
  if (header.length !== EXPECTED_HEADER.length || !header.every((col, i) => col === EXPECTED_HEADER[i])) {
    throw new Error(
      `Pantheon CSV header doesn't match the expected 34-column shape. Got: ${header.join(",")}`,
    );
  }

  const columnIndex = Object.fromEntries(header.map((col, i) => [col, i]));

  return dataLines.map((line, lineNumber) => {
    const fields = parseCsvLine(line);

    const id = fields[columnIndex.id ?? -1];
    const wdId = fields[columnIndex.wd_id ?? -1];
    const name = fields[columnIndex.name ?? -1];
    const slug = fields[columnIndex.slug ?? -1];
    const hpiRaw = fields[columnIndex.hpi ?? -1];
    if (!id || !wdId || !name || !slug || !hpiRaw) {
      throw new Error(
        `Pantheon CSV row ${lineNumber + 2} is missing a required id/wd_id/name/slug/hpi value.`,
      );
    }

    return {
      id,
      wdId,
      name,
      slug,
      occupation: fields[columnIndex.occupation ?? -1] ?? "",
      hpi: Number.parseFloat(hpiRaw),
      bplaceCountry: fields[columnIndex.bplace_country ?? -1] ?? "",
      dplaceCountry: fields[columnIndex.dplace_country ?? -1] ?? "",
      birthyear: parseOptionalInt(fields[columnIndex.birthyear ?? -1] ?? ""),
      deathyear: parseOptionalInt(fields[columnIndex.deathyear ?? -1] ?? ""),
    };
  });
}
