import { parseCsvLine } from './csv.js';

export interface PantheonPersonRow {
  id: string;
  wdId: string;
  // Kept for CSV structural validation (parsePantheonCsv requires it non-empty),
  // but Output reads a person's name from Wikidata's rdfs:label via the
  // enrichment pass (transform/index.ts's TaggedPerson), not this snapshot
  // value.
  name: string;
  // Wikipedia article slug; wikipediaUrl is built from it
  // (https://en.wikipedia.org/wiki/{slug}) since the CSV has no URL column.
  slug: string;
  occupation: string;
  hpi: number;
  // Empty string when unknown — present-day country of the birth/death
  // coordinates, not historical nationality (Pantheon's own FAQ is
  // explicit about this).
  bplaceCountry: string;
  dplaceCountry: string;
  // Astronomical numbering (year 0 = 1 BCE, docs/adr/0001-astronomical-year-numbering.md),
  // converted at parse time from Pantheon's `birthyear`/`deathyear`, which encode
  // BCE by a naive sign flip (551 BC -> -551, not astronomical -550); see
  // toAstronomicalYear.
  birthyear?: number;
  // Derived from `birthdate`/`deathdate` ("YYYY-MM-DD", BCE flagged by a
  // trailing " BC"). Kept only when the column's year agrees with
  // birthyear/deathyear (both astronomical), which the pipeline treats as ground
  // truth; they occasionally disagree (e.g. a Julian/Gregorian boundary date), and
  // a disagreeing month is dropped rather than attached to the wrong year.
  birthmonth?: number;
  deathyear?: number;
  deathmonth?: number;
  // Pantheon's alive/dead flag, the only signal separating a still-living person
  // (no deathyear yet) from one whose death date was never captured (e.g. an
  // unidentified historical figure). Output uses it, not deathyear presence
  // alone, to decide whether "no end date" means "ongoing".
  alive: boolean;
}

const EXPECTED_HEADER = [
  'id',
  'wd_id',
  'wp_id',
  'slug',
  'name',
  'occupation',
  'prob_ratio',
  'gender',
  'twitter',
  'alive',
  'l',
  'hpi_raw',
  'bplace_name',
  'bplace_lat',
  'bplace_lon',
  'bplace_geonameid',
  'bplace_country',
  'birthdate',
  'birthyear',
  'dplace_name',
  'dplace_lat',
  'dplace_lon',
  'dplace_geonameid',
  'dplace_country',
  'deathdate',
  'deathyear',
  'bplace_geacron_name',
  'dplace_geacron_name',
  'is_group',
  'l_',
  'age',
  'non_en_page_views',
  'coefficient_of_variation',
  'hpi',
];

function parseOptionalInt(value: string): number | undefined {
  return value === '' ? undefined : Number.parseInt(value, 10);
}

// Pantheon's birthyear/deathyear arrive negative for BCE via a naive sign flip
// (551 BC -> -551) rather than astronomical numbering (-550); see
// docs/adr/0001-astronomical-year-numbering.md. CE values (>= 0) are unaffected.
function toAstronomicalYear(
  pantheonYear: number | undefined,
): number | undefined {
  return pantheonYear === undefined || pantheonYear >= 0
    ? pantheonYear
    : pantheonYear + 1;
}

const PANTHEON_DATE_PATTERN = /^(\d{4})-(\d{2})-\d{2}( BC)?$/;

// `referenceYear` is the astronomical birthyear/deathyear. The month is trusted
// only when the date column's year agrees (see PantheonPersonRow), so the date
// string's BC suffix is converted to astronomical numbering too, as
// toAstronomicalYear does for the year columns.
function parseOptionalDateMonth(
  value: string,
  referenceYear: number | undefined,
): number | undefined {
  if (value === '' || referenceYear === undefined) return undefined;
  const match = PANTHEON_DATE_PATTERN.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined)
    return undefined;
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
  const lines = csvText.split('\n').filter((line) => line.length > 0);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    throw new Error('Pantheon CSV is empty.');
  }

  const header = parseCsvLine(headerLine);
  if (
    header.length !== EXPECTED_HEADER.length ||
    !header.every((col, i) => col === EXPECTED_HEADER[i])
  ) {
    throw new Error(
      `Pantheon CSV header doesn't match the expected 34-column shape. Got: ${header.join(',')}`,
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

    const birthyear = toAstronomicalYear(
      parseOptionalInt(fields[columnIndex.birthyear ?? -1] ?? ''),
    );
    const deathyear = toAstronomicalYear(
      parseOptionalInt(fields[columnIndex.deathyear ?? -1] ?? ''),
    );

    return {
      id,
      wdId,
      name,
      slug,
      occupation: fields[columnIndex.occupation ?? -1] ?? '',
      hpi: Number.parseFloat(hpiRaw),
      bplaceCountry: fields[columnIndex.bplace_country ?? -1] ?? '',
      dplaceCountry: fields[columnIndex.dplace_country ?? -1] ?? '',
      birthyear,
      birthmonth: parseOptionalDateMonth(
        fields[columnIndex.birthdate ?? -1] ?? '',
        birthyear,
      ),
      deathyear,
      deathmonth: parseOptionalDateMonth(
        fields[columnIndex.deathdate ?? -1] ?? '',
        deathyear,
      ),
      alive: (fields[columnIndex.alive ?? -1] ?? '').toUpperCase() === 'TRUE',
    };
  });
}
