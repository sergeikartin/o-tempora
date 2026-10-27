---
status: accepted
---

# Profiles are fetched at runtime as static JSON from our own server

## Context

`web` reads the dataset bundled at build time; nothing it renders changes after the build. A Profile (overview, Key Moments, Deep Facts, Connections) is several kilobytes of prose per entity, and Profiles ship for more entities over time. Bundling them would grow the lane chunks every visitor downloads for text most visitors never open. Importing them through `import.meta.glob` would grow the entry chunk instead, because its path-to-loader map has one entry per Profile.

## Decision

Output writes one file per entity per Locale, `profiles/<locale>/<slug>.json`. The `web` build copies that folder verbatim into `dist` (`vite-plugins/profiles-static.ts`, which also serves it in dev), and the panel fetches `<base>/profiles/<locale>/<slug>.json` when an entity whose row has `hasProfile` opens. `web` never probes for files.

This is a fetch of static JSON from our own origin, not live data: the files are as fixed as the bundled chunks and only a new build changes them. It is the first dataset not loaded through a bundler import, so it is the exception that `packages/web/CLAUDE.md` names, not a precedent for fetching anything else at runtime.

A failed fetch swaps the Description and Tagline into the same wide panel, so the panel never shows an error. A failed request is not cached, so reopening the entity retries.

## Consequences

- The panel opens at the Profile width at once with a quiet body placeholder, so nothing jumps on arrival.
- GitHub Pages sets the cache headers and offers no override; filenames are not hashed, so a deploy can take up to the Pages cache lifetime to reach a returning visitor (`docs/deployment.md`).
- Profiles are absent from the offline-first assumptions of the bundled chunks: with no network the panel falls back to the Description.
