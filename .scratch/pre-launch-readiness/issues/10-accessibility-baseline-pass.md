Type: task
Status: open

# Accessibility: baseline pass

## Question

Launch-readiness audit found no accessibility tooling anywhere in the repo: no `eslint-plugin-jsx-a11y`, no `axe-core`/`@axe-core/*` in `packages/web/package.json`, no a11y rules in `eslint.config.js`, and no a11y-debt ADR (the only related mention is an incidental `inert`-attribute detail in `packages/web/docs/adr/0006-css-animation-scope-and-detail-panel-always-mounted.md:15`, not a documented gap).

Sergei chose a baseline pass, not a full WCAG audit (chart-the-map grilling session): "not a full WCAG audit, but not ignored either."

Do:
- Add `eslint-plugin-jsx-a11y` to the lint config and fix whatever it flags.
- Run one manual/axe pass over the core interactions (pan/zoom, sidebar filters, detail panel, and the mobile drawer/bottom-sheet from commit `0b07b26`) and fix obvious issues — contrast, missing labels, focus handling, keyboard reachability.
- Record what was fixed vs. explicitly deferred (if anything) as this ticket's resolution, so deferred items can graduate into a future effort rather than being silently dropped.
