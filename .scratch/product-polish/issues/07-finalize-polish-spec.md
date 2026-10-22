Type: grilling
Status: resolved
Blocked by: 02, 04, 05, 06, 09

## Answer

[`../spec.md`](../spec.md): ten items in implementation order (image/data defects, 404, plain-language labels, desktop frame, phone first screen, Help and Empty Lane states, accessibility sweep, Entity Links, route split and landing shell, landing content), each locking its ticket's decision and naming its docs and ADRs, plus a launch check re-running the audit and a deferred list. No time budget or cut line, by the owner's call. Each item merges to `main` as it lands; the landing goes live only when items 9 and 10 are both done.

## Question

Write `spec.md`, the destination artifact: the prioritized, sized list of ~8–12 changes for the pre-launch pass, each with its design decision locked (linking the resolving ticket), implementation order, which living docs and ADRs each change touches, and an explicit list of what was deferred. Before writing, sweep **Not yet specified** on the map: graduate any fog that is now sharp enough to become part of the spec, using `../research/live-site-audit.md` to turn the remaining audit findings (defects with an obvious fix: image-slot blank, `http://` image URLs, 404 page, axe failures, touch targets) into spec items.
