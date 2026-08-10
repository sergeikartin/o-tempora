# 05 — Docs: new ADR + CLAUDE.md updates

**What to build:** Bring the data pipeline's documentation and architecture decision record history up to date with the sourcing changes made in tickets 02 and 04, so a future reader understands why `tagline` is now live-fetched for all three lanes and why a second live external dependency (Wikipedia's REST API) was deliberately added on top of the existing Wikidata-only sourcing.

**Blocked by:** 02 — Discoveries: live-fetch `tagline` instead of curated text; 04 — Wire the Wikipedia extract through as the new optional `description` field

**Status:** ready-for-agent

- [ ] The data pipeline's own top-level documentation accurately describes `tagline` being live-fetched for all three lanes (no remaining mention of Discoveries as a curated-only exception) and the new Wikipedia extract dependency behind `description`.
- [ ] A new architecture decision record captures: the field split itself (`tagline` required/Wikidata-sourced vs. `description` optional/Wikipedia-sourced); the addition of Wikipedia's REST API as a second live dependency and why that supersedes the earlier "no new live dependency" decision for this one field; and Discoveries' tagline sourcing moving from curated to live-fetched.
- [ ] The earlier "no new live dependency" decision record is left intact as historical record, with a short pointer note added noting it's superseded for this field specifically.
