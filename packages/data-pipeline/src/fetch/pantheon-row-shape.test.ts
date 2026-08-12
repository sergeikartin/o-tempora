import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePantheonCsv } from "./pantheon-row-shape.js";

const HEADER =
  '"id","wd_id","wp_id","slug","name","occupation","prob_ratio","gender","twitter","alive","l","hpi_raw","bplace_name","bplace_lat","bplace_lon","bplace_geonameid","bplace_country","birthdate","birthyear","dplace_name","dplace_lat","dplace_lon","dplace_geonameid","dplace_country","deathdate","deathyear","bplace_geacron_name","dplace_geacron_name","is_group","l_","age","non_en_page_views","coefficient_of_variation","hpi"';

function row(overrides: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    id: "14627",
    wd_id: '"Q935"',
    wp_id: "14627",
    slug: '"Isaac_Newton"',
    name: '"Isaac Newton"',
    occupation: '"PHYSICIST"',
    prob_ratio: "0",
    gender: '"M"',
    twitter: "",
    alive: "FALSE",
    l: "235",
    hpi_raw: "35.48016419061497",
    bplace_name: '"Woolsthorpe-by-Colsterworth"',
    bplace_lat: "52.809863",
    bplace_lon: "-0.62877",
    bplace_geonameid: "201088",
    bplace_country: '"United Kingdom"',
    birthdate: '"1643-01-04"',
    birthyear: "1643",
    dplace_name: '"Kensington"',
    dplace_lat: "51.5",
    dplace_lon: "-0.19",
    dplace_geonameid: "54732",
    dplace_country: '"United Kingdom"',
    deathdate: '"1727-03-31"',
    deathyear: "1726",
    bplace_geacron_name: '"woolsthorpe-by-colsterworth"',
    dplace_geacron_name: '"kensington"',
    is_group: "FALSE",
    l_: "30.988774869925628",
    age: "83",
    non_en_page_views: "2508822",
    coefficient_of_variation: "3.7821597382938283",
    hpi: "99.439201",
  };
  const fields = { ...defaults, ...overrides };
  return [
    fields.id,
    fields.wd_id,
    fields.wp_id,
    fields.slug,
    fields.name,
    fields.occupation,
    fields.prob_ratio,
    fields.gender,
    fields.twitter,
    fields.alive,
    fields.l,
    fields.hpi_raw,
    fields.bplace_name,
    fields.bplace_lat,
    fields.bplace_lon,
    fields.bplace_geonameid,
    fields.bplace_country,
    fields.birthdate,
    fields.birthyear,
    fields.dplace_name,
    fields.dplace_lat,
    fields.dplace_lon,
    fields.dplace_geonameid,
    fields.dplace_country,
    fields.deathdate,
    fields.deathyear,
    fields.bplace_geacron_name,
    fields.dplace_geacron_name,
    fields.is_group,
    fields.l_,
    fields.age,
    fields.non_en_page_views,
    fields.coefficient_of_variation,
    fields.hpi,
  ].join(",");
}

test("parses a normal row into the consumed fields", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row()}`);
  assert.deepEqual(rows, [
    {
      id: "14627",
      wdId: "Q935",
      name: "Isaac Newton",
      slug: "Isaac_Newton",
      occupation: "PHYSICIST",
      hpi: 99.439201,
      bplaceCountry: "United Kingdom",
      dplaceCountry: "United Kingdom",
      birthyear: 1643,
      birthmonth: 1,
      deathyear: 1726,
      deathmonth: undefined,
      alive: false,
    },
  ]);
});

test("parses the alive column as a boolean, true only for an exact 'TRUE' value", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row({ alive: "TRUE" })}\n${row({ id: "2", alive: "FALSE" })}`);
  assert.equal(rows[0]?.alive, true);
  assert.equal(rows[1]?.alive, false);
});

test("leaves deathmonth undefined when deathdate's own year (1727) disagrees with deathyear (1726) — Pantheon's two columns occasionally disagree", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row()}`);
  assert.equal(rows[0]?.deathmonth, undefined);
});

test("parses a BC birthdate (' BC' suffix, not a leading minus sign) into an astronomical-numbering-consistent month", () => {
  const rows = parsePantheonCsv(
    `${HEADER}\n${row({ id: "3395", wd_id: '"Q9441"', name: '"Gautama Buddha"', birthdate: '"0566-04-08 BC"', birthyear: "-566", deathdate: "", deathyear: "-452" })}`,
  );
  assert.equal(rows[0]?.birthmonth, 4);
});

test("leaves birthmonth/deathmonth undefined when the date column is empty", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row({ birthdate: "", deathdate: "" })}`);
  assert.equal(rows[0]?.birthmonth, undefined);
  assert.equal(rows[0]?.deathmonth, undefined);
});

test("converts a BCE birthyear/deathyear from Pantheon's naive sign flip to astronomical numbering", () => {
  // Pantheon's raw "-566"/"-452" (naive sign flip for 566/452 BC) become
  // astronomical -565/-451 (year 0 = 1 BCE) — see toAstronomicalYear.
  const rows = parsePantheonCsv(
    `${HEADER}\n${row({ id: "3395", wd_id: '"Q9441"', name: '"Gautama Buddha"', birthyear: "-566", deathyear: "-452" })}`,
  );
  assert.equal(rows[0]?.birthyear, -565);
  assert.equal(rows[0]?.deathyear, -451);
});

test("leaves birthyear/deathyear undefined when the CSV field is empty", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row({ birthyear: "", deathyear: "" })}`);
  assert.equal(rows[0]?.birthyear, undefined);
  assert.equal(rows[0]?.deathyear, undefined);
});

test("preserves an empty occupation as an empty string", () => {
  const rows = parsePantheonCsv(`${HEADER}\n${row({ occupation: "" })}`);
  assert.equal(rows[0]?.occupation, "");
});

test("throws when the header doesn't match the expected column shape", () => {
  assert.throws(() => parsePantheonCsv('"id","name"\n1,"Test"'), /header doesn't match/);
});
