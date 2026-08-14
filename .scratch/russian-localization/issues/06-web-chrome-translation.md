# 06 — Web: UI chrome Russian translation

**What to build:** Nav, buttons, and every taxonomy/filter label (Occupation Domain, Conflict Category, Milestone Category + groups, Region, Data Depth) render in Russian on the RU build, via an initial checked-in translation dictionary.

**Blocked by:** 05

**Status:** done — verified visually in a browser against the RU build (screenshots confirmed sidebar/taxonomy/detail-panel chrome fully in Russian, entity content unaffected)

- [ ] An initial Russian translation dictionary is checked into the repo, covering nav/button copy and every taxonomy/filter label surface listed above.
- [ ] The RU build (using ticket 05's language selector) consumes this dictionary; the EN build's copy is unchanged.
- [ ] No machine-translation dependency at build or runtime — the dictionary is static, reviewable, checked-in text, not a live API call.
- [ ] A manual pass across both language builds (dev server) confirms no leftover English chrome string on the RU build's primary flows (nav, filters, tooltips).
