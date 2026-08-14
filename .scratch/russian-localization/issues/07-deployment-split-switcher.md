# 07 — Deployment split + language switcher

**What to build:** The EN and RU builds are deployed as two independent static outputs, subpath-addressed (`/en`, `/ru`), each with a visible link to the sibling deployment's default view.

**Blocked by:** 05, 06

**Status:** done — verified live in a local production-equivalent preview (both subpaths load, switcher works both directions). No specific hosting provider was chosen (none existed before this ticket, and picking one is an infra/vendor decision outside this ticket's scope) — `dist/en/`+`dist/ru/` are already shaped for any static host's subpath deployment; see docs/deployment.md.

- [ ] The EN and RU builds are deployed as two independent static outputs, addressed via subpath (e.g. `/en`, `/ru`) under the same domain.
- [ ] Each build has a visible, always-present link to the sibling build's home/default view.
- [ ] No deep-link/viewport-state preservation is implemented — the switcher link goes to the sibling's default opening view (explicitly out of scope per the spec).
- [ ] Verified live (or in a production-equivalent preview) that both subpaths resolve correctly and the switcher link works in both directions.
