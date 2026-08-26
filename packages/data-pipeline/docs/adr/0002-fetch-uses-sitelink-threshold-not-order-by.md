---
status: accepted
---

# Fetch filters by sitelink threshold instead of ORDER BY

Fetch-stage SPARQL queries never `ORDER BY` sitelinks — at this corpus size the query times out. They use a sitelink threshold filter instead, and ranking happens later in the Score stage, not in Fetch.
