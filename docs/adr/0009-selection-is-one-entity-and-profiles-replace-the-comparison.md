---
status: accepted
supersedes: 0008-selection-is-a-set-and-overlap-is-drawn-as-bands.md
---

# The Selection is one entity, and Profiles replace the date-overlap comparison

## Context

`0008-selection-is-a-set-and-overlap-is-drawn-as-bands.md` made the Selection a set of up to four entities and drew their shared span as bands. The product's aim since then is that a visitor remembers who an entity was and wanders to related ones. A date overlap says two lives coincided; it says nothing of why that matters. Profiles (overview, Key Moments, Deep Facts, Connections) carry that, and their Connections lead from one entity to the next.

## Decision

- The Selection is the one entity whose panel is open. A click, a Search pick or a Connection replaces it; there is no multi-select, no "Add to comparison" control and no cap.
- Span Bands, Overlap Bands, `computeOverlap`, the overlap sentence and the Focus Range's "Overlap" label are removed. The Focus Range names the selected entity's own span.
- Relating entities is the job of a Profile's Connections, which may target any lane, not of a computed overlap.

## Why

One entity keeps the panel, the URL and the history simple, and gives the Profile the whole panel. Connections are authored, so they can say what a date overlap cannot, and they add no per-pair layout to the canvas.

## Considered Options

**Keep the comparison beside Profiles.** Rejected: a Profile and a comparison list compete for one panel, and the bands serve a question the product no longer leads with.

**Keep a single Span Band for the one entity.** Rejected: the Focus Range already names the span, and a wash behind every lane for one entity adds noise without a comparison to read.
