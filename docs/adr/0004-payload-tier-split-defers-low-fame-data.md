---
status: superseded
superseded-by: 0006-detail-level-merges-data-depth-and-payload-tier.md
---

# Payload Tier splits pipeline output by Fame Score to cut initial-load bytes

## Context

`people.json` ships every entry down to the pipeline's existing HPI≥75 floor (3,733 entries, ~3.7MB) even though the client's default Fame Score filter (Data Depth's "Mainstream" preset, HPI≥88) only ever renders 189 of them on first paint. The other ~3,500 are dead weight sitting inside the Suspense promise (`locale-datasets.ts`) that gates first render — the dominant contributor to the app's LCP.

## Decision

Each lane's Output stage (`write-datasets.ts`/`publish.ts`) now writes two files per locale instead of one: `<lane>.tier0.json` (fameScore at or above the existing Mainstream thresholds — People 88, Conflicts 82, Milestones 82) and `<lane>.tier1.json` (the remainder, down to today's pipeline floor). `packages/web` loads Tier 0 eagerly, unchanged Suspense contract, gating first paint as before; Tier 1 loads via a second `import()` kicked off at module scope but deferred to idle time, skipped on slow/save-data connections, and merged into the in-memory dataset once it resolves. Client-side Fame Score filtering (ADR 0003, `packages/web/docs/adr/`) is otherwise untouched — which tier an entry shipped in never affects whether it renders.

## Why

Fame Score is already computed, already the client's own density-control axis, and its Mainstream threshold is already tuned. Reusing it as the loading boundary means Tier 0 is, by construction, exactly what a default-state page load needs — with no risk of the loading boundary and the UI's density boundary drifting apart under later, unrelated tuning.

## Considered Options

**Runtime slicing in `packages/web`** (ship one full file, slice by threshold at Vite build time or in the browser). Rejected: `packages/shared-types` data is pipeline-generated-only by convention (`.claude/rules/code-conventions.md`) — slicing downstream of that would create a second, parallel splitting mechanism instead of extending the one Output already has for the locale split.

**Naming the tiers after the Data Depth preset** (`mainstream`/`deep-cut` chunk). Rejected: Data Depth is explicitly a client-side-only UI convenience, deliberately kept separate from the pipeline-side "Fame Tier" gating that ADR 0003 (`packages/web/docs/adr/`) retired. Naming this pipeline-side split after it would read as quietly reintroducing what that ADR rejected. "Tier 0"/"Tier 1" names the loading boundary as its own concept — see `CONTEXT.md`'s **Payload Tier**.

## Consequences

- `people.json`/`conflicts.json`/`milestones.json` (and `.ru` siblings) are replaced by `.tier0`/`.tier1` pairs. The only current readers — the pipeline's own Output/publish steps and `packages/web/src/app/locale-datasets.ts` — need updating; nothing else in the repo consumes the old bare filenames.
- `packages/web/CLAUDE.md`'s "no runtime data fetching" framing needs a note: Tier 1 is a build-time-bundled, network-deferred JS chunk (the same mechanism the existing locale split already uses), not a fetch of live or changing data.
