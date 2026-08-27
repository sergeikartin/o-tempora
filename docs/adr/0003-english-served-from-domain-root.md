---
status: accepted
---

# English Served From the Domain Root

The English build is served from `otempora.info`'s root instead of an `/en/` subpath; every other locale gets its own `/<locale>/` subpath — Russian at `/ru/` today, and the same pattern for any locale added later. We picked this over a symmetric `/en/`+`/ru/` structure because it gives the primary/default language cleaner canonical URLs, and since the site hasn't shipped yet there are no existing `/en/` links to preserve — no redirect or alias needed.
