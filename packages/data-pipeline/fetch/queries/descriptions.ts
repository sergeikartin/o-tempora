// English one-line descriptions for already-known candidate people, keyed
// on the Wikidata QID Pantheon retains per row (wd_id) — not a corpus
// scan, parameterized on a batch of specific Q-IDs, same shape as
// reigns.ts. Runs after fetch-pantheon.ts, on the subset of rows that
// clear the HPI specialist floor (see fetch-descriptions.ts), since
// Pantheon's CSV has no description-equivalent field of its own.
export function buildDescriptionsQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?person ?description WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person schema:description ?description . FILTER(LANG(?description) = "en") }
}
`.trim();
}
