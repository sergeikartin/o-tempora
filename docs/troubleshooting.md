# Troubleshooting

## Conflict starts in the wrong year

Check `period.start.year` in the published Conflicts dataset against the Description and end date. Wikidata’s P585 (point in time) can describe the end or an entire century. For example, it places the American Civil War in 1865 while P580 gives its 1861 start.

In `conflicts-enrichment.ts`, keep P580 before P585 in both the date and precision `COALESCE`. From the repo root, refresh the Conflicts lane, then build and publish the data.

```sh
npm run fetch --workspace packages/data-pipeline -- --lane=conflicts
npm run build-data --workspace packages/data-pipeline
npm run publish-data --workspace packages/data-pipeline
```

To refresh only enrichment, run `NODE_USE_ENV_PROXY=1 node src/fetch/fetch-conflicts-enrichment.ts` from `packages/data-pipeline` before building. Spot-check dates for newly curated conflicts.

## Hydration mismatch in dev

Prerendering runs on build, so the dev HTML has an empty `#root`. Hydrating that container triggers a mismatch at the app heading. In `main.tsx`, use `hydrateRoot()` when `rootElement.hasChildNodes()` and `createRoot().render()` otherwise.

For a blank built page, check the Network panel for a stalled Umami script. Keep it `async`. A `defer` analytics script shares the module entry’s ordered execution queue and can block hydration.
