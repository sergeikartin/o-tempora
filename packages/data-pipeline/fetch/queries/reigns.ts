// Reign / term-of-office periods for already-known candidate people. Unlike
// the other queries, this one isn't a blind corpus scan — it's parameterized
// on a batch of specific person Q-IDs, sourced from Pantheon's retained
// wd_id column (see fetch/fetch-reigns.ts).
//
// Broad by design, per the product decision: any qualified P39 ("position
// held") statement with a P580 (start time) qualifier counts, regardless of
// what the position actually is — monarchs, elected heads of state/
// government, military commands, etc. Wikidata has no single closed class
// for "ruler," so a title-based allowlist (king/queen/emperor/...) would
// systematically miss elected and appointed rulers.
//
// Needs the full p:/ps:/pq: statement model, not the wdt: truthy shortcut —
// P580/P582 here are qualifiers on the P39 statement itself (e.g. "held
// this specific position from X to Y"), not top-level claims on the person.
export function buildReignsQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?person ?reignStart ?reignEnd WHERE {
  VALUES ?person { ${values} }
  ?person p:P39 ?statement .
  ?statement pq:P580 ?reignStart .
  OPTIONAL { ?statement pq:P582 ?reignEnd . }
}
`.trim();
}
