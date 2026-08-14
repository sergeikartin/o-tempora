---
status: accepted
---

# Paraglide JS (stable API) replaces the hand-rolled UI-string i18n

## Context

UI-facing text is currently two hand-rolled, parallel mechanisms. `packages/web/src/shared/i18n/strings.ts` exports a `Strings` interface with hand-written `EN`/`RU` objects, selected by a ternary on `LANG` (`packages/web/src/shared/i18n/lang.ts`, itself read from Vite's `--mode`); interpolation is done via ad-hoc template-string closures (`filterByLabel`, `detailsAriaLabel`). Separately, taxonomy label maps (e.g. `DOMAIN_LABELS_EN`/`DOMAIN_LABELS_RU` in `packages/web/src/shared/config/occupation-domain-colors.ts`) repeat the same EN/RU-ternary pattern per file, once per taxonomy. Neither mechanism gives any compile-time guarantee that a key present in one locale is present in the other — a missing `RU` entry only surfaces as a blank label at runtime.

## Decision

Adopt Paraglide JS (`@inlang/paraglide-js`) as the single message-catalog mechanism for both the UI chrome strings and the taxonomy label maps, on its **stable API only** — `experimentalStaticLocale` and `experimentalPerLocaleBuild` are explicitly not used. `packages/web/src/shared/i18n/` (`strings.ts`, `lang.ts`) is retired; message catalogs move to `packages/web/messages/{en,ru}.json`-style files. Chrome keys stay flat/unprefixed (`siteTitle`, `detailsAriaLabel`, …, unchanged names); taxonomy labels get a `taxonomy.*` namespace (`taxonomy.domain.explorer`, `taxonomy.region.europe`, …) to keep enum-keyed taxonomy lookups visually distinct from free-form chrome copy. Both groups are migrated in one pass.

Each Language Build's locale is fixed via two parallel `project.inlang` config directories (`project.en.inlang/`, `project.ru.inlang/` — inlang requires the directory name itself to end in `.inlang`), each with a different `baseLocale`, selected by the Paraglide Vite plugin's `project` option branching on Vite's `mode` — the same place `vite.config.ts` already branches its data-file alias and `base` path for the Language Build split. Because the stable API doesn't tree-shake per locale, every Language Build's JS bundle contains both locales' compiled strings. Because the stable API also has no build-failing check for a key missing from one locale, a hand-written Vitest test diffs the `en`/`ru` message catalogs' keys and fails CI on any mismatch.

## Why

Paraglide's typed message functions replace the `STRINGS` ternary and the taxonomy `Record<Key,string>` duplication with a single, type-checked catalog and built-in interpolation, without adopting Lingui's macro + extraction (`.po` files) + translator-handoff pipeline — machinery built for coordinating with an external translation team, which this project doesn't have, since both locales are hand-written by whoever is editing the code.

## Considered Options

**Lingui** — rejected. Its `<Trans>`/`t` macros require a Babel/SWC plugin, and its `extract` → translate → `compile` cycle exists to hand strings to external translators via `.po` catalogs. That workflow is overhead with no payoff here.

**Paraglide's `experimentalStaticLocale` / `experimentalPerLocaleBuild`** — rejected. Both are non-GA as of research (2026), with no documented precedent matching this project's exact two-invocation `build:en`/`build:ru` model. Building the "more mature" replacement on an experimental flag undercuts the reason for replacing the hand-rolled version in the first place.

**Astro** (framework swap, raised mid-decision) — rejected. Its built-in i18n is routing-only (locale-prefixed URLs, `getRelativeLocaleUrl()`) and explicitly doesn't manage translation strings, so it wouldn't replace this work. Its islands architecture also fits content sites with isolated interactive widgets, not this app — the timeline, sidebar, detail panel, and filters share state continuously, which is the shape Astro's own docs flag as a poor fit for islands.

## Consequences

- Both locales' compiled strings ship in every Language Build's bundle — accepted, since it's a small, fixed set of UI copy, not the People/Conflicts/Milestones dataset (which is already swapped per Language Build via `vite.config.ts`'s existing alias mechanism, unaffected by this change).
- The missing-translation-fails-CI guarantee is enforced by a hand-written Vitest test, not by Paraglide itself.
- `packages/web/src/shared/i18n/` is removed entirely; anything importing `STRINGS` or `LANG` from there needs updating in the same pass as the taxonomy label maps.
