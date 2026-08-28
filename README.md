# O Tempora — Every Life in Context

**O Tempora** (`otempora.info`) is an interactive web-based historical visualization tool designed to explore notable human lives and major world events across a unified timeline.

## Overview

History is often learned in silos, making it difficult to visualize which historical figures were contemporaries or what global events were taking place during a specific person's lifetime. **O Tempora** solves this by providing a dynamic, synchronized view of historical biographies alongside major global conflicts, cultural milestones, and technological innovations.

**Live site:** [otempora.info](https://otempora.info) ([Russian](https://otempora.info/ru/))

## Local development

This is an npm workspaces monorepo:

- `packages/web` — the React + TypeScript + Vite + D3 frontend
- `packages/shared-types` — shared types and the generated data the app reads
- `packages/data-pipeline` — the offline pipeline that generates that data

From the repo root:

```
npm install
npm run dev --workspace packages/web
```

See [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md) for the full set of build/test/lint commands. `packages/shared-types/src/data/*.json` ships pre-built in the repo, so you don't need to run the data pipeline to work on `web` — only when changing the underlying data (see [`packages/data-pipeline/CLAUDE.md`](packages/data-pipeline/CLAUDE.md)).

## Data & attribution

The app's data (`packages/shared-types/src/data/*.json`) is derived from third-party datasets (Pantheon 2.0, Wikidata) and carries its own license terms, separate from the source code — see [`packages/shared-types/LICENSE-DATA.md`](packages/shared-types/LICENSE-DATA.md). The same attribution is also surfaced in-app via the "About" link.

## License

Source code is licensed under the [MIT License](LICENSE). Data licensing is separate — see above.
