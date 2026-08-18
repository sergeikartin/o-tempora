Type: grilling
Status: resolved

# License choice & README

## Question

The repo has no root `LICENSE` and no root `README` (audit confirmed — the only license file is `packages/shared-types/LICENSE-DATA.md`, which covers the *data* only and explicitly says the source code "is licensed separately, or not yet licensed at all"). Sergei confirmed (chart-the-map grilling session) the GitHub repo itself is going public alongside the deployed site, which makes both launch-blocking rather than optional polish.

Resolve:
- Which code license (e.g. MIT) — should account for `LICENSE-DATA.md`'s existing terms (Pantheon CC BY-SA 4.0, Wikidata CC0) so the two licenses don't conflict; see the map's Not-yet-specified note on this.
- What the README needs to cover for a public repo (project description, screenshot/link to the live site, local dev setup pointing at `packages/web/CLAUDE.md`'s build/test commands, data-sourcing/attribution note pointing at `LICENSE-DATA.md`).

## Answer

**Code license:** MIT, root `LICENSE` file, `Copyright (c) 2026 Sergei Kartin`. No conflict with the data license — MIT covers only the application source code; `packages/shared-types/LICENSE-DATA.md` continues to separately govern the generated data files (Pantheon CC BY-SA 4.0 subset, Wikidata/CC0), a standard multi-license split across disjoint subtrees of one repo. Root `package.json` got a matching `"license": "MIT"` field; the (all-`private: true`, never-published) workspace packages did not.

**README:** new root `README.md` — title "O tempora" (matches the live domain/brand over the `same-sky` repo slug), subtitle "World History Timeline," live-site link only (no screenshot — no social-preview asset exists yet; ticket 09 tracks creating one, and duplicating imagery ahead of that risked drift), local dev setup pointing at `packages/web/CLAUDE.md`'s build/test commands, and a short pointer line to `LICENSE-DATA.md` rather than a duplicated inline summary (keeps `LICENSE-DATA.md` the single source of truth). Root README only — `packages/*` already have their own `CLAUDE.md` docs, no separate public-facing stub READMEs needed for v1.

**In-app attribution (scope expanded mid-ticket):** grilling surfaced that CC BY-SA 4.0's attribution clause applies to wherever the Pantheon-derived data is *shared* — i.e. the live site itself, not just the source repo — reopening the open thread left in [alt-data-sources/issues/10](../../alt-data-sources/issues/10-pantheon-license-sharealike.md)'s answer ("exact placement/wording is an implementation detail, not decided further here"). Resolved in favor of building it now rather than spinning a separate ticket: a new `widgets/about-panel` (`packages/web/src/widgets/about-panel/`) — a centered modal dialog opened from an "About" link next to the Sidebar's existing language switcher — covers code license (MIT + GitHub link) and data attribution (Pantheon 2.0/Datawheel CC BY-SA 4.0 with the Yu et al. 2016 citation, Wikidata/CC0 note, link to `LICENSE-DATA.md` on GitHub). Localized EN/RU via the existing Paraglide `messages/{en,ru}.json`. Verified in the browser on both `/` and `/ru/` — content, links, Escape/backdrop-close, and styling all correct.
