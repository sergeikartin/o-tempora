# 01 — Heading-aware source excerpts and normalized audit context lookup

**Status:** resolved
**Blocked by:** None — can start immediately.

**What to build:** Upgrade HTML evidence extraction and audit context assembly so every excerpt carries its document title and section heading breadcrumb, adjacent windows never merge across section boundaries, and quotes that pass normalized evidence checking never silently lose their audit context window.

- Extend `Source` in `packages/data-pipeline/src/profiles/verification/policy.ts` with optional `title?: string` and `headings?: SourceHeading[]` (`{ level: 1 | 2 | 3 | 4 | 5 | 6; text: string; offset: number }`).
- Replace `htmlText()` in `packages/data-pipeline/src/profiles/verification/sources.ts` with a single-pass `extractHtmlDocument(html)` using `htmlparser2` that incrementally normalizes whitespace/NFC while recording `title` and exact character offsets of visible `h1`–`h6` headings (ignoring hidden tags and stripping Wikipedia `.mw-editsection` spans from heading text). Keep `htmlText()` exported as a thin wrapper returning `.text` for compatibility.
- Keep `parseSourceSnapshot()` backward-compatible with legacy evidence snapshots cached without `title`/`headings`: hash only the properties present on the snapshot object while still validating `title` and `headings` shapes when present.
- Export `headingPathAt(headings, offset)` and include `title` and `section` in `SourceStore.readExcerpt()` output so writers and repair agents see enclosing headings as they read.
- In `packages/data-pipeline/src/profiles/verification/researcher.ts` (`englishAuditPrompt`):
  - Locate quotes via `source.text.indexOf(normalizeText(item.quote))` instead of raw `item.quote`, fixing the bug where whitespace/NFC-normalized quotes drop out of `source_contexts`.
  - Compute each matched quote's `section` breadcrumb and merge overlapping 700-character windows only when `section` matches.
  - Emit `title` (when present) and structured `excerpts: { section: string[]; text: string }[]` on each `source_contexts` entry.
- In `packages/data-pipeline/src/profiles/verification/audit-saved.ts`, pass the full parsed `Source` snapshot (including `title` and `headings`) into `auditProfile()` instead of dropping everything except `text`.
- Update `packages/data-pipeline/prompts/profile-audit.md` (bump version and prompt hash) with concise guidance noting that `source_contexts` excerpts include document titles and `section` breadcrumbs.

## Acceptance criteria

- [x] `extractHtmlDocument` extracts normalized text identical to current `htmlText`, records document `<title>`, strips `.mw-editsection` noise from headings, and places every `heading.offset` at the exact character index in `source.text`.
- [x] `parseSourceSnapshot` accepts legacy cached snapshots that lack `title`/`headings` (validating their existing `id` hash) and validates new snapshots that include `title`/`headings`.
- [x] `SourceStore.readExcerpt` returns `title` (when present) and the active `section` heading breadcrumb for the returned excerpt offset.
- [x] `englishAuditPrompt` resolves quotes with whitespace/newline differences via `normalizeText`, keeping `source_excerpt_index` non-null and supplying the 700-character context window.
- [x] `englishAuditPrompt` keeps overlapping quotes from two different sections (e.g., `Biography` vs. `Legends and myths`) in separate `{ section, text }` entries instead of merging them across heading boundaries.
- [x] `auditSavedProfile` passes `title` and `headings` from saved snapshots through to `auditProfile`.
- [x] `packages/data-pipeline/prompts/profile-audit.md` version and recorded SHA-256 prefix match its updated prompt text (`prompt.test.ts` passes).
- [x] New unit tests in `packages/data-pipeline/src/profiles/verification/verification.test.ts` cover heading offset accuracy, `.mw-editsection` stripping, legacy snapshot compatibility, normalized quote context matching, cross-section non-merging, and `auditSavedProfile` heading propagation.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
