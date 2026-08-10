# 01 — Rename `description` → `tagline` everywhere (no behavior change)

**What to build:** The field holding Wikidata's short one-line subtitle text is renamed from `description` to `tagline` across the whole system — the data pipeline, the shared type definitions, and the web app. This is a pure rename: no entity's data source changes, and the running app looks identical to a user before and after. It exists to make the following tickets (live-fetching Discoveries' tagline, and adding a genuinely new `description` field) land as clean, unconfused changes rather than overloading one field name with two meanings mid-migration.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The field is named `tagline` (not `description`) consistently across the data pipeline's fetch, transform, and output stages, the shared type definitions, and the web app's rendering layer.
- [ ] People, Wars & Conflicts, and Discoveries all keep their *current* tagline source unchanged — live Wikidata fetch for People/Wars, hand-curated text for Discoveries. Sourcing changes are explicitly out of scope for this ticket.
- [ ] The detail panel renders exactly the same text as before this change — no visible difference in the running app.
- [ ] Any drop-reason/validation messaging that referenced "missing description" now reads "missing tagline" (or equivalent), consistent with the rename.
- [ ] All existing tests referencing the old field name are updated and passing; typecheck passes across both workspaces.
