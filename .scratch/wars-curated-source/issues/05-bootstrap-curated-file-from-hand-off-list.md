# 05 — Bootstrap: one-off script from the user's hand-off list

Type: task
Status: open
Blocked by: 01

## Question

Write a one-off script (`src/tools/bootstrap-wars-curated.ts` or similar) that converts the user-supplied list of conflicts into `data/raw/wars-curated.raw.json` (ticket 02's shape: `id`/`name`/`category`/optional `parentId`).

The list's exact hand-off format (plain text, CSV, markdown table — whatever the user actually pastes/provides) isn't fixed yet; write the parser directly against that shape once it arrives, rather than speculatively designing for a format that might not match. If the user references parents by name rather than QID (e.g. "Third Crusade, parent: Crusades"), resolve those to `parentId`s by matching against other rows in the same list — flag anything that doesn't resolve rather than silently dropping the relationship.

Explicitly not a reusable/rerunnable tool (unlike Discoveries' precedent or the earlier draft of this spec) — it exists to do this one conversion. Not source-parameterized, no dedupe-against-existing-file logic, no test suite (one-shot script, consistent with how this pipeline treats other one-off/non-pure entrypoints).

## Answer
