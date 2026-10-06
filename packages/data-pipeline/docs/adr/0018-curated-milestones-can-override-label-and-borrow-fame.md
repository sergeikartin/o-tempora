---
status: accepted
---

# Curated milestones can override their label and borrow another item's fame

Generic concept items (e.g. "car") read badly as milestones: the Wikidata label is a bare noun and the tagline is a dictionary definition. The milestone is better expressed by the first concrete instance (the Benz Patent-Motorwagen), but that item's own sitelinks and pageviews are a fraction of the concept's, so it would sink below the detail levels where readers expect to find it.

`milestones-curated.raw.json` entries therefore accept two optional fields. `displayName: {en, ru}` replaces the Wikidata label in both languages (e.g. "First car"); tagline, article, image, description and date still come from the entry's own item. `fameSource: <QID>` names a concept item whose sitelinks and per-language article URLs replace the entry's own when computing `fameScore`; Fetch enriches that QID alongside the curated ids and stores `fameSitelinks`/`fameArticleUrls` on the enriched row.

Both fields are curator-authored, so they are the one place the curated file carries display text; everything else stays live-fetched.
