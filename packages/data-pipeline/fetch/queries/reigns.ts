// Reign / term-of-office periods for already-known candidate people. Unlike
// the other queries, this one isn't a blind corpus scan — it's parameterized
// on a batch of specific person Q-IDs, sourced from Pantheon's retained
// wd_id column (see fetch/fetch-reigns.ts).
//
// Restricted to positions that are Head of State (wd:Q48352) or Head of
// Government (wd:Q2285706), or a P279* subclass of either — this still
// covers monarchs and elected heads of state/government without a
// title-based allowlist (king/queen/president/prime minister/... would be
// unbounded and locale-specific), but excludes the rest of a person's P39
// history. An earlier version of this query accepted *any* qualified P39
// statement with a start time, on the theory that a closed "ruler" class
// doesn't exist on Wikidata; in practice that also pulled in every other
// position with a dated qualifier — e.g. Isaac Newton's Lucasian
// Professorship and Royal Society presidency, J.S. Bach's Thomaskantor
// appointment — none of which are reigns. Trade-off: this also now excludes
// non-head-of-state/government roles the old query caught on purpose, like
// military commands.
//
// "Emeritus"/honorific continuations (e.g. "Pope emeritus", still subclassed
// under Pope -> Head of State) are excluded by label text, not by Q-ID —
// Wikidata models these as retaining the parent office's class, so a
// successor's genuine reign (e.g. Pope Francis, 2013-2025) ends up
// overlapping the predecessor's now-honorary one (Benedict XVI "Pope
// emeritus," 2013-2023) unless filtered out explicitly. A class-based
// exclusion doesn't generalize here — the genuine "Pope" position chains up
// through "honorific"/"title of honor" too, so excluding by ancestor class
// would also drop real popes.
//
// Needs the full p:/ps:/pq: statement model, not the wdt: truthy shortcut —
// P580/P582 here are qualifiers on the P39 statement itself (e.g. "held
// this specific position from X to Y"), not top-level claims on the person.
export function buildReignsQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?person ?reignStart ?reignEnd ?positionLabel WHERE {
  VALUES ?person { ${values} }
  VALUES ?leadershipType { wd:Q48352 wd:Q2285706 }
  ?person p:P39 ?statement .
  ?statement ps:P39 ?position .
  ?position wdt:P279* ?leadershipType .
  ?statement pq:P580 ?reignStart .
  OPTIONAL { ?statement pq:P582 ?reignEnd . }
  OPTIONAL { ?position rdfs:label ?positionLabel . FILTER(LANG(?positionLabel) = "en") }
  FILTER(!BOUND(?positionLabel) || !CONTAINS(LCASE(?positionLabel), "emeritus"))
}
`.trim();
}
