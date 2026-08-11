# 07 — Docs: new ADR + CLAUDE.md/troubleshooting updates

**What to build:** Record the combined-file → per-lane-file split and the concurrency convention as a new ADR, and bring `packages/data-pipeline/CLAUDE.md` and `docs/troubleshooting.md` up to date with the new `--lane` flag.

**Blocked by:** 01, 02, 03, 04, 05, 06

**Status:** resolved

- [x] New ADR (`packages/data-pipeline/docs/adr/0012-lane-scoped-fetch.md`, next number after 0011) covering: why the three combined-output stages became per-lane files (adding `--lane` scoping would otherwise still cost a full three-lane pass on those stages); the deliberate choice not to add a concurrency lock, and why that's safe (documented convention, solo-maintainer/on-demand pipeline, no CI); and an explicit note that `fetchWikipediaExtracts`'s shared 2 req/sec pacing comment (existing code, not changed by this effort) is only a real courtesy ceiling when lane-scoped fetches aren't run concurrently.
- [x] `packages/data-pipeline/CLAUDE.md`: `fetch` script description updated to mention `--lane`; "Data Pipeline" section's Fetch step description updated to reflect per-lane raw files instead of combined ones; new short note (near the `fetch` script documentation) stating the "don't run concurrent lane fetches" convention.
- [x] `docs/troubleshooting.md`: its existing entry documenting ad hoc `npx tsx src/fetch/fetch-wars-enrichment.ts` invocation updated or supplemented to mention `--lane=wars` as the now-preferred way to re-run a single lane.
- [x] Root `CONTEXT.md`'s **Lane** entry (already added during the grilling session — see `.scratch/lane-scoped-fetch/spec.md`) cross-links the new ADR.
