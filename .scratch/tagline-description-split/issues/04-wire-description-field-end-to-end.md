# 04 — Wire the Wikipedia extract through as the new optional `description` field

**What to build:** The actual user-facing payoff of this whole effort. The Wikipedia extract data produced by ticket 03 is threaded through the pipeline's transform and output stages, the shared type definitions, and the web app's detail panel — so that opening any person, war, or discovery in the running app shows a real paragraph of prose beneath its short tagline, wherever a Wikipedia article was found. `description` is optional throughout: its absence never causes an entity to be dropped, and the UI never shows a broken or empty section when it's missing.

**Blocked by:** 01 — Rename `description` → `tagline` everywhere; 03 — Wikipedia lead-extract fetch infrastructure

**Status:** ready-for-agent

- [ ] Every entity in the published dataset carries an optional `description` field, populated with its Wikipedia lead-paragraph extract when one was resolved, and simply absent otherwise.
- [ ] No entity is ever dropped from the published output solely because it lacks a `description` — only a missing `tagline` still causes a drop.
- [ ] The detail panel shows `tagline` as a short subtitle under the entity's name, and — when present — `description` as a full paragraph of body text below it.
- [ ] When `description` is absent, the panel shows the subtitle alone, with no empty, broken, or placeholder body section.
- [ ] No truncation or length cap is applied to `description` anywhere in the pipeline or the UI.
- [ ] Demoable end-to-end: opening a person, a war, and a discovery in the running app each shows the beefier body text where a Wikipedia article was available for that entity.
- [ ] Tests cover both the "description present" and "description absent" rendering cases, and the pipeline-side pass-through, for all three lanes (including new coverage for People, which currently has none at this seam).
