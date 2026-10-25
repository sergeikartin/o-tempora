# Spec: Profiles

Terms are in `CONTEXT.md`: **Profile**, **Key Moment**, **Deep Facts**, **Connection**, **Detail Level**, **Selection**, **Entity Link**, **Description**. Decisions are in `map.md` and the resolved tickets under `issues/`.

## Problem

The detail panel answers "who overlapped whom" with a date-overlap comparison (ADR 0008). It tells a visitor when lives coincided but gives them nothing to remember about an entity or a reason to move to another one.

## Solution

Replace the comparison with **Profiles**: a generated overview, **Key Moments**, up to three **Deep Facts** and **Connections**. A visitor learns who the entity was, then follows a Connection to a related one in any lane. An entity with no Profile keeps its **Description**.

First batch: 30 entities (20 People, 4 Conflicts, 6 Milestones) in five connected Legendary clusters, English only.

## Behaviour

- Selecting an entity opens its panel. If the row has `hasProfile`, the panel opens at once at the wide Profile width (440px; the 80vh sheet on a phone) with name and tagline pinned and a quiet body placeholder, then shows the Profile.
- A failed Profile fetch swaps in the Description and Tagline in the same wide panel.
- A Connection lists every target in the dataset, whatever the lane or filters. A target below the current Detail Level is marked with the level it appears at; opening it raises the Detail Level and pans to it. A target not in the dataset is not listed.
- Every Connection hop adds a history entry. Mark clicks and Search keep today's rule.
- `**bold**` in text renders as elements, never HTML.
- Russian files carry the English Profile whole until Russian Profiles exist.

## Pipeline

- Writing: the `profile-writer` agent from `packages/data-pipeline/prompts/profile.md` (v2.1.0), one entity at a time, from model knowledge. Checking: the `profile-verifier` agent. Gating: only `reviewed` and `edited` Profiles ship. ADR 0021 covers the rest, including the deterministic `profiles` plan/finalize script (skip results already at the current `prompt_hash`, regenerate stale only on a flag, never overwrite `edited`).
- Output reads the raw Profile files and writes `shared-types` `profiles/<locale>/<slug>.json`. It sets `hasProfile` on each row in both language files, resolves each Connection to `{slug, reason, name, lane, detailLevel}` (unresolved targets dropped), and rejects a Profile with unpaired `**` or other markup.
- Shipped shape: `overview`, `keyMoments[{date, title, text}]`, `deepFacts[{text, isLegend}]`, `connections`. The `Profile` types move from `web` to `shared-types`.

## Build tickets

Numbering continues from the map; each becomes `issues/NN-<slug>.md` with `Status: open` when filed.

1. **Profile types and Output** (`data-pipeline`, `shared-types`): move the types, add the Output step, `hasProfile`, validation, tests. Includes a `data-pipeline` ADR if Output needs a new stage.
2. **`profiles` plan/finalize script** (`data-pipeline`): as in ADR 0021.
3. **Generate and review the 30** (human-in-the-loop): run the writer and verifier, the owner promotes `draft` to `reviewed`.
4. **Panel loads shipped Profiles** (`web`): replace `sample-profiles.ts` with the per-entity fetch, the placeholder and failure fallback, `hasProfile`, and a copy of `profiles/` into `dist`.
5. **Reduce the Selection to one entity** (`web`): remove multi-select, Span and Overlap Bands, `computeOverlap`, the overlap sentence, "Add to comparison" and the Focus Range "Overlap" label; the Entity Link carries one slug; arrival still fits the viewport to the entity.
6. **Connection history and Detail Level raise** (`web`): a hop adds a history entry; opening a below-level target raises the Detail Level.
7. **Docs and ADRs**: see below.
8. **Landing hands off to a Profile** (`web`, blocked by 4 and 5): each Curiosity gets a `lead` and an optional `anchor`; the call-to-action opens the lead's Entity Link plus `#moment-<n>` / `#fact-<n>`; the panel scrolls to and accents that item (instant scroll under `prefers-reduced-motion`; the accent clears when another entity opens, Back restores it; invalid fragments are ignored); `curiosities.test.ts` pins each anchor to a Key Moment date or Deep Fact phrase; the per-mark links and `landing_mark_open` are removed. Decision: `issues/09-landing-without-multi-selection.md`.

Review-gate automation (map ticket 08) is not part of this spec.

## Docs and ADRs

New:
- Root ADR superseding `0008-selection-is-a-set-and-overlap-is-drawn-as-bands.md`: a Selection is one entity, Profiles replace the comparison.
- `web` ADR superseding `0016-url-carries-a-selection-and-arrival-fits-it.md`.
- `web` ADR for fetching Profiles at runtime: a fetch of static JSON on our own server, not live data.
- `web` ADR for the wider panel and Profile chrome, if ticket 5 changes `0017`'s chrome.
- `web` ADR for the landing handoff: a landing-only URL fragment anchors a Key Moment or Deep Fact.

Living docs to update with the work: `CONTEXT.md` (Selection, Span Band, Overlap Band, Focus Range, Entity Link, Curiosity, Landing Page), `docs/product-scope.md`, `docs/observability.md`, `docs/deployment.md` (cache headers for `profiles/`), `packages/web/CLAUDE.md` (it says no runtime fetching of data and describes only the four Detail Level chunks), `packages/web/DESIGN.md`, `packages/web/PRODUCT.md`, `packages/web/docs/timeline-rendering.md`, `packages/web/docs/code-conventions.md`, and `packages/data-pipeline/CLAUDE.md`.

## Selection becomes one entity

The Selection is a single entity and the Entity Link carries one `?e=<slug>`. The panel never lists several members. This retires multi-select (Shift/Ctrl/Cmd-click, "Add to comparison"), Span and Overlap Bands, the overlap sentence, and the Focus Range "Overlap" label; the Focus Range shows the one entity's span.

The Landing Page's call-to-action therefore opens one `lead` entity instead of all of a Curiosity's marks; see ticket 8.

## Out of scope

A quiz feature; filtering or navigating by categories; live LLM calls from the web app; rollout beyond the 30; Russian Profiles; a docked right panel (still open from the prototype).
