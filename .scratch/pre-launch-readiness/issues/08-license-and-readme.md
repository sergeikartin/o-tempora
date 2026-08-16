Type: grilling
Status: open

# License choice & README

## Question

The repo has no root `LICENSE` and no root `README` (audit confirmed — the only license file is `packages/shared-types/LICENSE-DATA.md`, which covers the *data* only and explicitly says the source code "is licensed separately, or not yet licensed at all"). Sergei confirmed (chart-the-map grilling session) the GitHub repo itself is going public alongside the deployed site, which makes both launch-blocking rather than optional polish.

Resolve:
- Which code license (e.g. MIT) — should account for `LICENSE-DATA.md`'s existing terms (Pantheon CC BY-SA 4.0, Wikidata CC0) so the two licenses don't conflict; see the map's Not-yet-specified note on this.
- What the README needs to cover for a public repo (project description, screenshot/link to the live site, local dev setup pointing at `packages/web/CLAUDE.md`'s build/test commands, data-sourcing/attribution note pointing at `LICENSE-DATA.md`).
