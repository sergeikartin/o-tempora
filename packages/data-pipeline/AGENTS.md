# packages/data-pipeline

The on-demand Node.js and TypeScript pipeline is the sole producer of published datasets. Its stages are Fetch → Score and Tag → Output → Publish. Commit raw snapshots under `data/raw/` and publish generated files through the pipeline.

## Commands

Run from the repo root with `npm run <script> --workspace packages/data-pipeline`.

| Script | Purpose |
|---|---|
| `fetch` | Refresh raw data. Add `-- --lane=<people\|conflicts\|milestones>` or `-- --qids=Q1,Q2` to narrow the run. Combine the flags as needed. Run one fetch at a time to respect Wikipedia pacing. |
| `build-data` | Build datasets and approved Profiles in gitignored `data/output/`. |
| `publish-data` | Copy the built files into `packages/shared-types/src/data/`. |
| `test`, `typecheck`, `lint` | Run the Node tests, TypeScript or package-root Biome checks. Use `lint:fix` to apply fixes. The pre-commit hook checks staged files. |

## Docs

- Read the data flow before changing sources, curation, scoring, tags or output. [Data flow](docs/data-flow.md)
- Read the Profile workflow for planning, writing, verification or translation. [Profiles](docs/profiles.md)
- Read the package conventions before implementing pipeline changes. [Conventions](docs/code-conventions.md)
- Read relevant decisions before changing pipeline architecture. [ADRs](docs/adr/)
