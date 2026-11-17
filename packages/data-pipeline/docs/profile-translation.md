# Russian Profile translation

`profiles verify` automatically translates each approved or already-current English Profile into Russian and independently audits its fidelity. A translation problem makes the command exit nonzero while retaining the English approval. `build-data` and the web app only read saved files.

Backfill or retry without rerunning historical research:

```sh
npm run profiles --workspace packages/data-pipeline -- translate --qids=Q635,Q12138,Q935
```

API execution accepts `--provider`, `--model`, and `--audit-model` (same provider; defaults to the translation model). Within `verify`, `--translation-model` selects the translator independently; it defaults to the audit model. Translation audits always use `--audit-model`. Session mode selects models by agent role instead. `--force` on `translate` retranslates a current translation. Session execution uses `--execution=session --session-dir=<absolute directory>` and the [session workflow](profile-sessions.md), with separate `translate` and `translation-audit` requests. It needs no provider credentials or source fetching.

The translator receives every reader-facing English field: overview, Key Moment dates/titles/prose, Deep Facts and Connection explanations. It preserves meaning, qualifications, attribution, numeric values and bold emphasis. A separate audit covers every field, checking semantic fidelity and idiomatic Russian. Audit defects trigger one correction attempt and another complete audit; remaining defects hold the translation. Structure, source URLs, legend flags and QIDs remain unchanged; Connection display names come from the Russian dataset.

Approved translations live beside their English source as `<QID>-<name>.ru.translation.json`. The artifact stores the source content hash, translation policy, translated fields, model metadata, audit and approval hash. Any source/content/identity/policy change invalidates it; source approval and current dataset dates are also required. Rejected audit candidates go to `*.ru.translation.held.json`, preserving an existing approved translation. A retry uses held feedback only when its source hash and policy still match. Translated files are generated artifacts; hand edits invalidate approval.

Output publishes only current, approved translations to `profiles/ru/<slug>.json` and marks only those Russian rows with `hasProfile`. Missing or stale translations leave the Russian Description; English prose is never copied into Russian Profile files. English publication is independent.
