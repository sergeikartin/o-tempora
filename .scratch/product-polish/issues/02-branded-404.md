Type: task
Status: ready-for-agent

The branded bilingual 404 is implemented (`a6ed816`): `packages/web/public/404.html`, preview-server fallback and deployment docs. It links to `/timeline/` and `/ru/timeline/` without loading timeline JS or datasets.

## Remaining

- [ ] Add the originally requested return links to the Landing Page at `/` and `/ru/` alongside the existing timeline links.
- [ ] Verify an unknown path on the production-equivalent preview serves this page without breaking the four page entries or prerender plugins.
- [ ] Record axe and Russian-length checks at 390 and 1440 px; no result for these acceptance checks is recorded in this ticket.

Docs: `docs/deployment.md` if 404 behaviour changes.
