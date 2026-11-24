# Russian Profile translation

`profiles verify` automatically translates each approved or already-current English Profile into Russian and independently audits its fidelity. A translation problem makes the command exit nonzero while retaining the English approval. `build-data` and the web app only read saved files.

Backfill or retry without rerunning historical research:

```sh
npm run profiles --workspace packages/data-pipeline -- translate --qids=Q635,Q12138,Q935
```

API execution accepts `--provider`, `--model`, and `--audit-model` (same provider; defaults to the translation model). Within `verify`, see the [API model selection rules](profile-verification.md) for translation and audit. `--force` on `translate` retranslates a current translation. For conversation subagents, the [Profile coordinator](profile-coordinator.md) uses `russian-translation` and `russian-audit` with the same fidelity rules.

The translator receives every reader-facing English field: overview, Key Moment dates, titles and prose, Deep Facts and Connection explanations. The pipeline retains the English structure, source URLs, legend flags and QIDs. Connection display names come from the Russian dataset.

Translation, correction and fidelity audit tasks include an optional glossary from the committed Russian dataset. It supplies canonical names and available Taglines for the subject and its Connections, plus up to 500 characters of the subject’s Russian Wikipedia lead. Use it for names, declensions, standard titles and terminology. The approved English passages supply every factual claim. Each prompt appends its per-Profile JSON after the fixed instructions. Current policy 1 approvals remain eligible for reuse.

Approved translations live beside their English source as `<QID>-<name>.ru.translation.json`. The artifact stores the source content hash, translation policy, translated fields, model metadata, audit and approval hash. Any source/content/identity/policy change invalidates it; source approval and current dataset dates are also required. Rejected audit candidates go to `*.ru.translation.held.json`, preserving an existing approved translation. A retry uses held feedback only when its source hash and policy still match. Translated files are generated artifacts; hand edits invalidate approval.

Output publishes only current, approved translations to `profiles/ru/<slug>.json` and marks only those Russian rows with `hasProfile`. Missing or stale translations leave the Russian Description; English prose is never copied into Russian Profile files. English publication is independent.

## Fidelity review

Before submitting, compare each Russian sentence with its English source. Check who did what, what the action was directed at or produced, and which qualifications apply. Check facts, dates, attribution, numeric values and bold emphasis across all fields. Reread the Russian for flow, then compare any sentence changed during that pass with the English again.

The independent audit covers every field. Faithful idiomatic paraphrases pass. Each blocking finding names the affected field, identifies the specific source detail the Russian must preserve, and explains what the current wording makes a reader misunderstand or miss. If the auditor suggests a rewrite, check it against the English before using it. The source detail is the criterion for clearing the finding. The workflow allows one correction and a fresh full audit before holding a candidate with unresolved findings.
