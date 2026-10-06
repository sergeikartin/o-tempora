---
status: accepted
---

# Curated milestones can override their date

Milestones are dropped when Wikidata has no date claim on any of the ten candidate properties, or when the date it has is wrong. The right item for a milestone is often undated while a nearby item is dated but reads as something else: the Mayflower ship has no date and its voyage item lacks an English article, and the Convention of Kanagawa carries a 1864 date for a 1854 treaty. Swapping the QID loses the entry or its fame, and the pipeline has no other way to correct a date.

`milestones-curated.raw.json` entries therefore accept an optional `date: {year, month?, endYear?, endMonth?}`. When present it replaces all four resolved date fields together, so an override without `endYear` is point-shaped even if Wikidata has an end date. An optional `approximate: true` marks the date as an estimate: it is published as `approximateDate: true` on the milestone and the detail panel prefixes the date with "ca.". Everything else (label, tagline, article, image, fame) still comes from the entry's own item. The override is validated at the Fetch boundary: integer years, months 1-12, and `endMonth` only alongside `endYear`.

Like `displayName` and `fameSource` (ADR 0018), it is curator-authored data in the curated file. Conflicts has no equivalent.
