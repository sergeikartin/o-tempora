# Render images for Wars & Conflicts in the entity detail drawer

Type: task
Status: resolved
Blocked by: 11

## Question

`packages/web/src/widgets/detail-panel/lib/build-drawer-content.ts`'s `warEntryContent` currently hardcodes War/WarEvent to never read `image`/`imageAttribution` off the entity, per a comment citing Dynamic tooltips spec §3.3 ("War & Conflicts never gets an image, full stop"). `ui/DetailPanel.tsx`'s rendering itself is already fully generic (`showImage = Boolean(content.image) && ...`) — no new rendering logic needed, only wiring the two fields through in `warEntryContent` the same way `personContent`/`discoveryContent` already do.

Land:

1. `warEntryContent` passes `entry.image`/`entry.imageAttribution` through, same as the other two content builders. Update/remove the "never gets an image" comment.
2. Update `.scratch/dynamic-tooltips/spec.md` §3.3 ("No image" bullet), §4.2 ("Wars & Conflicts: no changes — out of scope"), and §6's out-of-scope bullet — all three currently assert Wars & Conflicts stays image-free; correct them to reflect the reversal, with a pointer to this map.
3. Sanity-check `DetailPanel`'s existing failed-image-load handling (`failedEntityId` state, spec §3.1) needs no War/WarEvent-specific change — it's already keyed generically by entity id, should just work once `content.image` can be non-undefined for a `'war'` entityType.

## Answer

Landed. `build-drawer-content.ts`'s `warEntryContent` now passes `entry.image`/`entry.imageAttribution` through, same as `personContent`/`discoveryContent` — the "War & Conflicts never gets an image, full stop" comment removed. `ui/DetailPanel.tsx` needed no changes at all, confirmed rather than assumed: its rendering (`showImage = Boolean(content.image) && ...`, the `failedEntityId` fallback) is already fully generic over `content.image`/`content.imageAttribution`/`selected.entity.id`, with no War/WarEvent-specific branch to remove.

Updated `.scratch/dynamic-tooltips/spec.md`: §3.3's "No image" bullet (War), §3.4's matching WarEvent bullet, §4.1's `image` field doc, §4.3's "Wars & Conflicts: no changes" bullet, and §6's out-of-scope bullet (struck through, not deleted, so the doc keeps its own history) — all now point at this map as the effort that reversed the original out-of-scope call.

`build-drawer-content.test.ts`: replaced "War: never carries an image" with two cases (image/imageAttribution pass through when present; are undefined when absent) and fixed an unrelated pre-existing `partOfWarLine` reference in a Discovery test (stale from before "Remove partOfWarName" landed, caught by this ticket's typecheck pass). `npm run typecheck`/`test`/`lint`/`lint:boundaries --workspace packages/web` all clean (110/110 tests).
