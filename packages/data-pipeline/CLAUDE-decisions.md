# packages/data-pipeline — Decisions

<!-- Package-specific architecture decisions. Product scope and invariants: ../../CLAUDE-decisions.md -->

### Stack

| Layer | Technology |
|---|---|
| Pipeline query layer | Wikidata Query Service (SPARQL) |
| Pipeline scripting | Node.js + TypeScript |
| Pipeline intermediate storage | Local JSON files, checked into the repo |
| Testing | `node:test` |

### System Boundaries

- Pipeline stages: `fetch/` (raw SPARQL results only) → `transform/` (score + tag) → `output/` (writes final JSON into `packages/shared-types/src/data/`).

### Data Pipeline

Runs on-demand, not continuously — no scheduler, no live connection once data is generated.

1. **Fetch** — SPARQL pulls candidate people/events, plus a reign/term-of-office query parameterized on the people already found. Written as-is to `packages/data-pipeline/data/raw/`, checked into git for reproducibility.
2. **Score** — fame score is sitelink count directly; no other signal blended in for v1.
3. **Tag** — raw Wikidata occupation/location claims mapped onto the app's fixed occupation/region categories via an explicit lookup table (lossy by necessity).
4. **Output** — final `people.json`/`events.json` written into `packages/shared-types/src/data/` (single copy).

No manual override/correction mechanism exists in v1 — a bad ranking or tag is fixed by changing Score/Tag logic and re-running, not patched by hand.

### Architecture Decisions Log

- Historical events (wars/battles/treaties) and inventions/discoveries are fetched as two separate raw snapshots (structurally different SPARQL queries), merged into one `events.json` only at Transform — keeps Fetch from reshaping data (Invariant 8).
- Fetch queries never `ORDER BY` sitelinks (times out at this corpus size) — they use a sitelink threshold filter instead; ranking happens in Score.
- `WAR_TYPE_QID` is defined once in Fetch and imported by Transform/Output, so "what counts as a war" has one source of truth.
- A Fetch-stage query can depend on another Fetch-stage query's raw output (the reigns fetch reads the people fetch's output for its candidate ID list) — still consistent with Invariant 8, since it's reading IDs, not reshaping data.
