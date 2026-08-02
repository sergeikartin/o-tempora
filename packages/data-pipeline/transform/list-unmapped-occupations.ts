import fs from "node:fs";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { groupRows } from "./group-rows.js";
import { OCCUPATION_CATEGORIES } from "./occupation-categories.js";

// Dumps any occupation Q-ID a grouped person carries that isn't yet in
// OCCUPATION_CATEGORIES. Run after each batch of manual additions to
// occupation-categories.ts until this reports zero.
const raw = validateSparqlResultShape(
  JSON.parse(fs.readFileSync("data/raw/people.raw.json", "utf8")),
);

const people = groupRows(raw.results.bindings, {
  entityVar: "person",
  labelVar: "personLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "birthDate",
  secondaryDateVar: "deathDate",
  tagVar: "occupation",
  countryVar: "country",
});

const unmapped = new Set<string>();
for (const person of people) {
  for (const occupationId of person.tags) {
    if (!(occupationId in OCCUPATION_CATEGORIES)) unmapped.add(occupationId);
  }
}

if (unmapped.size === 0) {
  console.log("No unmapped occupation Q-IDs.");
} else {
  console.log(`${unmapped.size} unmapped occupation Q-ID(s):`);
  for (const id of unmapped) console.log(`  ${id}`);
  process.exitCode = 1;
}
