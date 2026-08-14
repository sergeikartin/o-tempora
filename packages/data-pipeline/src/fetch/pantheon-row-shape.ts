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
  // Kept for CSV structural validation (parsePantheonCsv requires it
  // non-empty) but no longer read by Output — a person's display name is
  // now sourced from Wikidata's rdfs:label via the same batched
  // enrichment pass as tagline (see transform/index.ts's TaggedPerson),
  // not this frozen Pantheon snapshot value.
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
  // Astronomical numbering (year 0 = 1 BCE — see
  // docs/adr/0001-astronomical-year-numbering.md), converted at parse time
  // from Pantheon's own `birthyear`/`deathyear` column convention, which
  // encodes BCE via a naive sign flip instead (551 BC -> -551, not the
  // astronomical -550) — see toAstronomicalYear.
  birthyear?: number;
  // Derived from the `birthdate`/`deathdate` columns (format "YYYY-MM-DD",
  // BCE flagged by a trailing " BC" rather than a leading minus sign —
  // Pantheon's own convention). Only kept when that column's own year
  // agrees with birthyear/deathyear (both compared in astronomical
  // numbering) — the two columns occasionally disagree (e.g. a
  // Julian/Gregorian calendar-boundary date), and birthyear/deathyear is
  // what the rest of the pipeline already treats as ground truth, so a
  // disagreeing month is dropped rather than risk attaching it to the
  // wrong year.
  birthmonth?: number;
  deathyear?: number;
  deathmonth?: number;
  // Pantheon's own alive/dead flag — the only source signal distinguishing
  // a genuinely still-living person (no deathyear because there isn't one
  // yet) from one whose death date is simply unrecorded (no deathyear
  // because Pantheon never captured it, e.g. an unidentified historical
  // figure). Output relies on this rather than deathyear presence alone
  // when deciding whether "no end date" means "ongoing."
  alive: boolean;
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

// Pantheon's birthyear/deathyear columns already arrive as negative for
// BCE, but via a naive sign flip (551 BC -> -551) rather than astronomical
// numbering (551 BC -> -550, since year 0 = 1 BCE) — see
// docs/adr/0001-astronomical-year-numbering.md. CE values (>= 0) are
// unaffected; only the BCE shift applies.
function toAstronomicalYear(pantheonYear: number | undefined): number | undefined {
  return pantheonYear === undefined || pantheonYear >= 0 ? pantheonYear : pantheonYear + 1;
}

const PANTHEON_DATE_PATTERN = /^(\d{4})-(\d{2})-\d{2}( BC)?$/;

// `referenceYear` is the already-astronomical birthyear/deathyear — the
// month is only trusted when the date column's own year agrees with it
// (see PantheonPersonRow's comment), so this parses the date string's BC
// suffix into astronomical numbering too, the same conversion
// toAstronomicalYear applies to the CSV's separate birthyear/deathyear
// column.
function parseOptionalDateMonth(value: string, referenceYear: number | undefined): number | undefined {
  if (value === "" || referenceYear === undefined) return undefined;
  const match = PANTHEON_DATE_PATTERN.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined) return undefined;
  const year = match[3] ? 1 - Number(match[1]) : Number(match[1]);
  if (year !== referenceYear) return undefined;
  return Number(match[2]);
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

    const birthyear = toAstronomicalYear(parseOptionalInt(fields[columnIndex.birthyear ?? -1] ?? ""));
    const deathyear = toAstronomicalYear(parseOptionalInt(fields[columnIndex.deathyear ?? -1] ?? ""));

    return {
      id,
      wdId,
      name,
      slug,
      occupation: fields[columnIndex.occupation ?? -1] ?? "",
      hpi: Number.parseFloat(hpiRaw),
      bplaceCountry: fields[columnIndex.bplace_country ?? -1] ?? "",
      dplaceCountry: fields[columnIndex.dplace_country ?? -1] ?? "",
      birthyear,
      birthmonth: parseOptionalDateMonth(fields[columnIndex.birthdate ?? -1] ?? "", birthyear),
      deathyear,
      deathmonth: parseOptionalDateMonth(fields[columnIndex.deathdate ?? -1] ?? "", deathyear),
      alive: (fields[columnIndex.alive ?? -1] ?? "").toUpperCase() === "TRUE",
    };
  });
}
