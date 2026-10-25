# Shipped Profile data shape

Type: grilling
Status: resolved
Blocked by: 01

## Question

What does `shared-types` ship and how does `web` load it? Cover: Profile fields in `shared-types` and what is dropped from the raw JSON (meta, categories, unmatched Connections); whether Profiles ride inside the `detail<N>` delta files or load lazily per entity or per level (payload size at about 513 entities versus 30); how a Connection is stored (target id/slug resolved at Output) so web needs no matching; locale files and Field Fallback; and how `**bold**` is rendered safely.

## Answer

- **Marker:** Output sets `hasProfile: true` on each entity row that has a Profile, in both language files. `web` never probes for files.
- **Files:** one file per entity per Locale, `profiles/<locale>/<slug>.json`, written into `shared-types`. `ru` is a copy of `en` until Russian Profiles exist, so Field Fallback stays baked at Output and `web` needs no change when they arrive.
- **Delivery:** the `web` build copies the folder verbatim into `dist`; the panel fetches `<base>/profiles/<locale>/<slug>.json` when it opens. No `import.meta.glob` (its path→loader map grows the entry chunk with every Profile). Cache headers go in `docs/deployment.md`. This is a runtime fetch of static JSON on our own server, not live data; needs a `web` ADR and wording fixes in `web`'s `CLAUDE.md` and the Detail Level text.
- **Loading:** a marked entity opens at the wide Profile width at once (name and tagline pinned, quiet body placeholder), so nothing jumps on arrival. A failed fetch silently swaps in the Description and Tagline in the same wide panel.
- **Shape:** `overview`, `keyMoments[{date, title, text}]`, `deepFacts[{text, isLegend}]`, `connections`. Dropped: `meta`, `claims`, `source`, `confidence`, the Deep Fact `type`, `subject`/`type`/`wikipedia_url`, `importance`. The `Profile` types move from `web` to `shared-types`.
- **Connection:** `{slug, reason, name, lane, detailLevel}`, in the model's importance order, resolved at Output; unresolved targets are dropped. No years, so the prototype's Connection row loses its dates line.
- **Bold:** text keeps raw `**`; `web` renders it with `parseBoldRuns` as elements, never HTML. Output rejects a Profile with unpaired `**` or other markup (`<`, `[x](url)`).
