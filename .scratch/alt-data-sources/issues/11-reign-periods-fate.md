Type: grilling
Status: resolved

## Question

Pantheon retains `wd_id` (Wikidata QID) for every row, so the existing `reigns.ts` Q-ID-batch SPARQL query could still run unmodified as a secondary enrichment pass — see [Pantheon schema research](../issues/05-research-pantheon-schema.md). Does `Person.reignPeriods` stay in scope as a secondary Wikidata enrichment step keyed on Pantheon's `wd_id`, or is it dropped/deferred anyway (e.g. to avoid keeping any live Wikidata dependency in the People lane at all, now that People was supposed to fully leave Wikidata)?

## Context

Unblocked by the Pantheon schema research — this was previously deferred fog pending exactly this fact.

## Answer

Keep `Person.reignPeriods` as a secondary Wikidata enrichment pass, keyed on Pantheon's `wd_id` instead of a primary SPARQL scan. The existing `reigns.ts` batched Q-ID lookup mechanism needs no structural changes — just a different source for its input Q-ID list. It's already the cheapest/most-targeted of the four query shapes and already has per-batch error handling (per the query-reliability research), so it doesn't reintroduce the instability problem this map exists to fix.
