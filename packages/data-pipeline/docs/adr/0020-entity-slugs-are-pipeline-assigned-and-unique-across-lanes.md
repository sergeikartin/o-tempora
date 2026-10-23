---
status: accepted
---

# Entity slugs are assigned by the pipeline, unique across lanes

## Context

An Entity Link (`packages/web/docs/adr/0015-…`) needs a readable identifier. Entity ids are Pantheon/Wikidata ids, unreadable in a URL. The URL carries the identifier alone, with no lane, so it must be unique across People, Conflicts and Milestones, and it must work in both locales, whose names differ.

## Decision

Every entity carries a `slug`, assigned at Output time (`src/output/slugs.ts`) after all lanes are built:

- Derived from the English name (diacritics folded, lowercase ASCII words joined by `-`), so the Russian dataset carries the same slug.
- Of the entities sharing a name, the most famous keeps the plain slug (ties by id); the others get their id appended (`john-smith-q123`). A name with no ASCII letters or digits falls back to the id.
- Computed once off the English builds and applied to both language builds by id, like `row`.

## Why

The web package can't derive it: it would need English names while the Russian dataset carries Russian ones, and uniqueness needs the whole dataset. Appending the id to the less famous entity (rather than numbering `-2`, `-3`) keeps their slugs stable when unrelated entities are added.

## Considered Options

**Slug from the displayed name.** Rejected — Cyrillic URLs that differ per locale, so the language switch would need a mapping.

**Slug unique per lane, lane in the URL.** Rejected — a longer URL for no reader benefit.

**Numbering collisions (`-2`).** Rejected — the numbers shift when the dataset changes, breaking shared links.
