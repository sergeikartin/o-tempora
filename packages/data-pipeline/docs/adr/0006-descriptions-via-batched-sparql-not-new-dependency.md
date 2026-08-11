# People descriptions fetched via batched SPARQL, not a new live dependency

Pantheon's CSV has no description field. Rather than accept a missing/synthetic description or add a new live dependency (e.g. Wikipedia's REST API), descriptions are fetched via the existing batched-SPARQL pattern (`fetch-descriptions.ts`, mirrors `fetch-reigns.ts`), keyed on `wd_id` and scoped to only the rows clearing the HPI specialist floor (~3,840 of 126,582 rows) — this reuses already-hardened retry/batching infrastructure instead of introducing a second kind of live fetch.

> **Superseded for one field only** by `0011-tagline-description-split-and-wikipedia-rest-dependency.md`: the field this ADR describes was renamed `Tagline` and stays SPARQL-sourced exactly as decided here (this ADR's reasoning still holds for it). A separate new field, `Description`, was added on top — real Wikipedia article prose, which has no SPARQL-reachable equivalent — introducing Wikipedia's REST API as the pipeline's second live dependency after all. `fetch-descriptions.ts`/`fetch-taglines.ts` itself was later renamed to match `Tagline`'s new name.
>
> The `fetch-reigns.ts` this ADR cites as the pattern it mirrored was itself deleted by `0014-remove-reign-periods.md` — the pattern reference above is historical only, not a live file.
