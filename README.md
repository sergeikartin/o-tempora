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

See [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md) for the full set of build/test/lint commands.

## Data & attribution

The app's data (`packages/shared-types/src/data/*.json`) is derived from third-party datasets (Pantheon 2.0, Wikidata) and carries its own license terms, separate from the source code — see [`packages/shared-types/LICENSE-DATA.md`](packages/shared-types/LICENSE-DATA.md). The same attribution is also surfaced in-app via the "About" link.

## License

Source code is licensed under the [MIT License](LICENSE). Data licensing is separate — see above.
