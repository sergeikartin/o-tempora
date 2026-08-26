# 04 — Verify and record the LCP win

**What to build:** Not new code — a real, measured before/after confirmation that prerendering the default viewport ([[03-build-time-prerender-of-the-default-viewport]]) actually improved LCP, per spec.md user story 16 ("As a maintainer investigating a future LCP regression, I want a real before/after LCP trace of this change, so that the win is measured rather than assumed"). ADR 0013's Consequences section explicitly calls for this re-trace to confirm the lane marks (rather than JS bundle parse/boot time, font loading, or something else) were actually the remaining bottleneck post-ADR-0012.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Capture an LCP trace (e.g. via the `chrome-devtools-mcp:debug-optimize-lcp` skill, or Lighthouse) against the built `dist/` output for both `/index.html` and `/ru/index.html`, on a throttled connection/CPU profile comparable to what ADR 0012's original ~5.9s/~4.1-4.4s measurements used.
- [ ] Record the new LCP figure and identify the actual LCP element post-change (confirm it's a lane mark or axis label, not something else like font loading or JS parse time).
- [ ] Confirm no visible flash/flicker/re-layout at hydration in a real browser (not just automated tests) — a quick manual pass on both locales.
- [ ] Confirm the JS-disabled fallback (real content, no interactivity) on both locales.
- [ ] If the win is smaller than expected or the bottleneck has shifted elsewhere, note that as a follow-up rather than silently closing this out — this ticket's job is to report the real number, not to guarantee a specific result.
- [ ] Record the measured before/after LCP figures and the confirmed LCP element under this file's `## Comments` — ADR 0013 itself is append-only and isn't edited to carry the measurement (`docs/agents/issue-tracker.md`'s convention).
