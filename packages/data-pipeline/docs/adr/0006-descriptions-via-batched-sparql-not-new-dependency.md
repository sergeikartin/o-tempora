# People descriptions fetched via batched SPARQL, not a new live dependency

Pantheon's CSV has no description field. Rather than accept a missing/synthetic description or add a new live dependency (e.g. Wikipedia's REST API), descriptions are fetched via the existing batched-SPARQL pattern (`fetch-descriptions.ts`, mirrors `fetch-reigns.ts`), keyed on `wd_id` and scoped to only the rows clearing the HPI specialist floor (~3,840 of 126,582 rows) — this reuses already-hardened retry/batching infrastructure instead of introducing a second kind of live fetch.
