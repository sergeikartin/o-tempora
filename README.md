# O Tempora

**Every life in context** — a read-only, continuously zoomable visualization of world history (~800 BCE–present). Three lanes — **People**, **Conflicts**, and **Milestones** — hardcoded ahead of time, with pan/zoom, fame-based density filtering, and occupation/region filters. No accounts, no editing, no live data fetching.

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

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — repo overview and the documentation map (what to read, and when)
- [`CONTEXT.md`](CONTEXT.md) — domain glossary and terminology
- [`docs/product-scope.md`](docs/product-scope.md) — what's in/out of scope, and why
- [`docs/adr/`](docs/adr/) — architecture decision records (also `packages/{web,data-pipeline}/docs/adr/` for package-scoped decisions)

## Data & attribution

The app's data (`packages/shared-types/src/data/*.json`) is derived from third-party datasets (Pantheon 2.0, Wikidata) and carries its own license terms, separate from the source code — see [`packages/shared-types/LICENSE-DATA.md`](packages/shared-types/LICENSE-DATA.md). The same attribution is also surfaced in-app via the "About" link.

## License

Source code is licensed under the [MIT License](LICENSE). Data licensing is separate — see above.
