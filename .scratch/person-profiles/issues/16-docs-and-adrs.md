# Docs and ADRs

Type: task
Status: resolved
Blocked by: 13, 14, 15, 17

## What to build

The sweep that the other tickets leave behind. Each ticket updates the docs it changes in the same unit of work (root `CLAUDE.md`); this one closes the gaps and checks the whole set against `spec.md` ("Docs and ADRs").

- [x] ADRs exist: Selection-as-one-entity (root), URL/Entity Link (`web`), runtime Profile fetch (`web`), wider panel and Profile chrome if it changed `0017`, landing handoff fragment (`web`); superseded ones carry `status: superseded` / `superseded-by`.
- [x] `GLOSSARY.md`: Selection, Focus Range, Entity Link, Curiosity and Landing Page match current behaviour. Retired Span Band and Overlap Band terms are removed.
- [x] Living docs match current behaviour: `docs/product-scope.md`, `docs/observability.md` (no `landing_mark_open`), `docs/deployment.md`, `packages/web/AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `docs/timeline-rendering.md`, `docs/code-conventions.md`, `packages/data-pipeline/AGENTS.md`. Both package `CLAUDE.md` files import their `AGENTS.md`.
- [x] The audited living docs describe current behaviour and leave decision history to the ADRs.

## Comments

Tracker reconciliation (2026-11-15): Tickets 13, 14, 15 and 17 are resolved, so this sweep is unblocked. Root ADR 0009 and web ADRs 0018/0019 already exist. Remaining confirmed gaps include the landing-handoff fragment decision, Connection push-history versus web ADR 0019, and `docs/product-scope.md` still describing first-mark/per-mark landing links. The glossary has the single-entity/Profile concepts; the full checklist above remains to be audited.

The sweep verified the glossary, package instructions, design and code conventions against current behaviour. The panel retains the below-Top-Bar placement specified by ADR 0017. Its width and Profile content are documented in `DESIGN.md`. [Web ADR 0021](../../../packages/web/docs/adr/0021-entity-links-can-open-a-profile-passage.md) supersedes 0019 and records the Landing Page handoff, Profile Anchor behaviour and Connection history.
