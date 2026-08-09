# Remove vis-timeline, update docs

Type: task
Status: open
Blocked by: 01, 02, 03, 04

## Task

Once all three lanes are ported and zoom works under D3:

- Delete the old vis-timeline-specific code: `options.ts`'s `subgroupStack`/`stackSubgroups` machinery, the `rangechange`/reentrancy-guard sync in `TimelineCanvas.tsx`, `toLegacyDate()`/`shared/lib/dates.ts`'s legacy-`Date` conversion if nothing else still needs a legacy `Date` by this point.
- Remove `vis-timeline` from `packages/web/package.json`.
- Rewrite `TimelineCanvas.test.tsx` against the new D3 implementation — the current tests mock `vis-timeline/standalone` entirely; that mock and its assertions need to go, not just get patched.
- Update `packages/web/docs/code-conventions.md`'s "Timeline Rendering (vis-timeline)" section to describe the D3 conventions instead.
- Update `packages/web/CLAUDE.md`'s Stack table (`Timeline rendering | vis-timeline (standalone build)` → D3) and its top description line (`React 19 + TypeScript + Vite + vis-timeline`).
