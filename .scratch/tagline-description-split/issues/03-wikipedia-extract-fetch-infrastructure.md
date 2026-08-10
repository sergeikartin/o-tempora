# 03 — Wikipedia lead-extract fetch infrastructure

**What to build:** A new fetch pass, independent of everything else, that pulls each entity's Wikipedia lead-paragraph extract (real prose, not Wikidata's short tag) for every People/Wars/Discoveries entity with a resolvable English Wikipedia article. This is the raw-data foundation for the new `description` field — it produces the data but doesn't wire it into the published dataset or the UI yet, so it can be built and verified entirely on its own.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Running the pipeline's fetch step produces a Wikipedia lead-paragraph extract for every entity (across all three lanes) that has a resolvable English Wikipedia article.
- [ ] Requests are paced to roughly Wikimedia's REST courtesy rate (~2/second), sent with a proper identifying User-Agent, and retried with backoff on rate-limit (429, respecting `Retry-After`) and server-error (5xx) responses.
- [ ] Disambiguation-page results and empty extracts are treated as "no extract available for this entity," not as errors.
- [ ] A single entity's fetch failure (network error, missing page, malformed response, etc.) is logged and skipped without aborting the rest of the fetch run.
- [ ] Extracted text has stray non-printable/formatting Unicode characters stripped before being written out.
- [ ] This stage's output is not yet consumed by transform, output, or the web app — verified and tested standalone, at its own dedicated network-client test seam plus a fetch-pacing/cleaning test seam.
