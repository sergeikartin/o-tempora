# Docs and ADRs

Type: task
Status: open
Blocked by: 13, 14, 15, 17

## What to build

The sweep that the other tickets leave behind. Each ticket updates the docs it changes in the same unit of work (root `CLAUDE.md`); this one closes the gaps and checks the whole set against `spec.md` ("Docs and ADRs").

- [ ] ADRs exist: Selection-as-one-entity (root), URL/Entity Link (`web`), runtime Profile fetch (`web`), wider panel and Profile chrome if it changed `0017`, landing handoff fragment (`web`); superseded ones carry `status: superseded` / `superseded-by`.
- [ ] `CONTEXT.md`: Selection, Span Band, Overlap Band, Focus Range, Entity Link, Curiosity and Landing Page match the new behaviour; retired terms are removed.
- [ ] Living docs match current behaviour: `docs/product-scope.md`, `docs/observability.md` (no `landing_mark_open`), `docs/deployment.md`, `packages/web/CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`, `docs/timeline-rendering.md`, `docs/code-conventions.md`, `packages/data-pipeline/CLAUDE.md`.
- [ ] No living doc carries history, changelogs or ticket numbers.

## Comments

Tracker reconciliation (2026-11-15): Tickets 13, 14, 15 and 17 are resolved, so this sweep is unblocked. Root ADR 0009 and web ADRs 0018/0019 already exist. Remaining confirmed gaps include the landing-handoff fragment decision, Connection push-history versus web ADR 0019, and `docs/product-scope.md` still describing first-mark/per-mark landing links. The glossary has the single-entity/Profile concepts; the full checklist above remains to be audited.
