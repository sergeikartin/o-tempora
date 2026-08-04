Type: grilling
Status: resolved

## Question

For whatever stays on Wikidata (Wars outside 1600-1973, Events & Inventions unless Vetustas fully replaces it), should the Fetch stage switch from the live SPARQL endpoint to a static Wikidata dump to fix the reliability problem (502s/timeouts documented in `CLAUDE-activeContext.md`), or stay on live SPARQL with the query itself redesigned?

## Answer

No bulk dump. Stay on live SPARQL and redesign ("cook") the query instead — batching/pagination strategy, timeout/retry tuning, or query-complexity reduction. Concrete redesign options are unresolved — see the Wikidata query reliability research ticket.
