Type: task
Status: open

# Performance: LCP and general audit

## Question

No performance budget or Core Web Vitals check exists anywhere in the repo — nothing in CI, no Lighthouse config, no documented target for LCP on the initial timeline render (which loads the full static JSON dataset and does an initial D3/canvas paint).

Do:
- Run a Lighthouse/Chrome DevTools performance trace against the deployed (or a production build of the) app, on both a representative desktop and throttled-mobile profile.
- Check LCP specifically, plus the other Core Web Vitals (CLS, INP) and overall Lighthouse performance score.
- Identify what's driving LCP (dataset fetch/parse size, initial canvas paint, font loading, etc.) and fix anything clearly cheap to fix (bundle splitting, deferred non-critical work, asset compression).
- Record the baseline numbers and any fixes applied (or explicitly deferred, with why) as this ticket's resolution.
