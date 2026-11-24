# 04 — Russian Wikipedia terminology glossary injection and cache-friendly prompt layout

Status: resolved
**Blocked by:** 01 (needs `ProfileSubject.ru` metadata from `subjects.ts`).

**What to build:** Reduce the first-pass Russian fidelity hold rate by injecting canonical Russian names, taglines, and truncated Russian Wikipedia lead excerpts (already committed in `data/raw/`) into Russian translation, correction, and fidelity-audit prompts, while moving all variable JSON payloads to the end of those prompts so static instruction prefixes hit provider prompt caches across batches.

- **Pure glossary builder (`packages/data-pipeline/src/profiles/translation.ts`):**
  - Export `RussianGlossary` and `buildRussianGlossary(raw: unknown, subjectsByQid: ReadonlyMap<string, ProfileSubject>): RussianGlossary | undefined`:
    - Look up the subject's `meta.source.wikidata_qid` in `subjectsByQid`; when `subject.ru?.name` is present, include `{ en: subject.name, ru: subject.ru.name, ...(tagline_ru), ...(lead_ru) }` where `lead_ru` is `subject.ru.description` cleanly truncated at a sentence/word boundary to at most 500 characters.
    - For each Connection in `raw.connections` with a `qid` present in `subjectsByQid` whose `ru?.name` exists, include `{ en: target.name, ru: target.ru.name, ...(tagline_ru) }` (deduplicated by QID, preserving order).
    - Return `undefined` when neither subject nor any Connection has Russian metadata.
- **Prompt-cache-friendly template refactor:**
  - Update `packages/data-pipeline/prompts/profile-translation.md` (bump version to `2.5.0` and update its 12-char SHA-256 prefix) so all instructions appear at the top with no mid-prompt placeholders, and the pipeline appends one JSON object at the end: `{ passages, ...(glossary ? { glossary } : {}), ...(feedback ? { feedback } : {}) }`.
  - Update `packages/data-pipeline/prompts/profile-translation-audit.md` (bump version to `2.5.0` and update its 12-char SHA-256 prefix) so all instructions appear at the top and the pipeline appends one JSON object at the end: `{ english, russian, ...(glossary ? { glossary } : {}) }`.
  - Update `packages/data-pipeline/prompts/profile-translation-repair.md` (bump version to `1.1.0` and update its 12-char SHA-256 prefix) to note optional `glossary` in its appended JSON object.
  - Instruct translator, repairer, and fidelity auditor to use `glossary` strictly as canonical Russian naming and terminology reference (proper names, declensions, standard Russian titles), while translating only the factual claims present in the approved English Profile—never importing extra facts from `lead_ru`.
- **Wire glossary through API and coordinator paths:**
  - Update `translationPrompt(raw, feedback?, glossary?)`, `russianAuditPrompt(raw, fields, glossary?)`, `prepareTranslationCorrection(raw, feedback, glossary?)`, and `translateProfile({ ..., glossary? })` in `packages/data-pipeline/src/profiles/translation.ts` so `glossary` is optional (keeping existing call sites and tests backward-compatible).
  - Update `packages/data-pipeline/src/profiles/coordinator.ts` (`russianTranslation`, `russianAudit`) and `packages/data-pipeline/src/profiles/index.ts` (`verify`, `translate`) to build `glossary` from the loaded `subjects` map and pass it into every Russian translation, correction, and audit call.
  - Keep `TRANSLATION_POLICY_VERSION = '1'` unchanged so existing approved `*.ru.translation.json` artifacts remain valid and skipped.
- **Living docs:** Update `packages/data-pipeline/docs/profile-translation.md` to document the Russian dataset terminology glossary and its non-factual boundary.

## Acceptance criteria

- [x] `buildRussianGlossary` extracts canonical Russian names/taglines for the subject and in-dataset Connections, truncates `lead_ru` cleanly to at most 500 characters, omits entries without `ru.name`, and returns `undefined` when no Russian metadata exists.
- [x] `profile-translation.md` (v2.5.0), `profile-translation-audit.md` (v2.5.0), and `profile-translation-repair.md` (v1.1.0) have matching recorded SHA-256 prefixes (`prompt.test.ts` passes) and place all variable JSON strictly at the end of the rendered prompt so static prefixes are byte-identical across different Profiles.
- [x] `translationPrompt`, `russianAuditPrompt`, and `prepareTranslationCorrection` include `glossary` in their trailing JSON when provided and omit it cleanly when absent.
- [x] Coordinator (`russian-translation`, `russian-audit`) and API (`verify`, `translate`) paths both supply `glossary` derived from `loadSubjects()`.
- [x] `TRANSLATION_POLICY_VERSION` stays `'1'`; existing approved Russian translations continue passing `approvedTranslation()` and skipping re-translation.
- [x] Unit tests in `packages/data-pipeline/src/profiles/translation.test.ts` (and coordinator round-trip tests in `verification.test.ts`) verify glossary construction/truncation, prefix cache stability across two distinct Profiles, glossary presence in translation/repair/audit prompts, and existing-receipt compatibility.
- [x] `packages/data-pipeline/docs/profile-translation.md` reflects the terminology glossary.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
