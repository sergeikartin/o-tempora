---
status: accepted
supersedes: 0011-selection-highlight-as-concentric-ring-marks.md
---

# Selected marks get a translucent ink halo, not a bronze ring

## Context

ADR 0011 gave a selected mark two concentric duplicates behind it: a parchment gap ring and a bronze (`--color-accent-selection-ring`) outer ring, plus a bronze label. Bronze is a mid-tone warm hue: it sat close to the Public Figure and Social & Human Culture marks it was meant to stand apart from, and the gap ring existed only to keep it from touching the mark. The result read as a second outline competing with the mark, and as one more category color rather than as state.

## Decision

A selected mark draws a single duplicate behind it: a wider round-capped `<line>` (Period) or `<circle>` (PointInTime) filled with `--color-selection-halo`, ink at 14% opacity, extending `SELECTION_HALO_PX` (8px) past the grown mark on every side. The mark keeps its own color on top, still grows to its hover size, and its label stays in ink with the 1.15 hover scale. The gap ring and the bronze ring are removed, so every mark has four fixed children (hit area, halo, mark, label) instead of five.

## Why

A translucent fill lets the parchment show through, so it needs no gap band against any lane hue and no per-hue contrast tuning, and one shape replaces two. Ink is the system's highest-contrast, hue-neutral color, so the halo reads against People, Conflict and Milestone marks alike. Because the halo is filled rather than stroked around the mark, it reads as emphasis on the mark rather than as a second outline.

## Consequences

- `--color-accent-selection-ring` is removed; the halo uses `--color-selection-halo`.
- A selected label is distinguished by the halo and its scale, not by color.
- Any new mark shape needs its own halo duplicate (line/circle today), created lazily on first selection by `ensureHaloChild`.
- The oxblood accent stays scoped to the viewport indicator, focus ring and active controls.
