# Russian Profile translation

The [Profile coordinator](profile-coordinator.md#russian) uses `russian-translation` to prepare a candidate from current approved English. A fresh subagent audits every field through `russian-audit`. A held translation leaves the English approval available for publication.

The translator receives every reader-facing English field: overview, Key Moment dates, titles and prose, Deep Facts and Connection explanations. Each field preserves its numeric values, including repetitions. Russian clauses can reorder those values. The pipeline retains the English structure, source URLs, legend flags and QIDs. Connection display names come from the Russian dataset.

Translation, correction and fidelity audit tasks include an optional glossary from the committed Russian dataset. It supplies canonical names and available Taglines for the subject and its Connections, plus up to 500 characters of the subject’s Russian Wikipedia lead. Use it for names, declensions, standard titles and terminology. The approved English passages supply every factual claim. Each prompt appends its per-Profile JSON after the fixed instructions. Current policy 1 approvals remain eligible for reuse.

Approved translations live beside their English source as `<QID>-<name>.ru.translation.json`. The artifact stores the source content hash, translation policy, translated fields, model metadata, audit and approval hash. Any source/content/identity/policy change invalidates it; source approval and current dataset dates are also required. Rejected audit candidates go to `*.ru.translation.held.json`, preserving an existing approved translation. A retry uses held feedback only when its source hash and policy still match. Translated files are generated artifacts; hand edits invalidate approval.

Output publishes only current, approved translations to `profiles/ru/<slug>.json` and marks only those Russian rows with `hasProfile`. Missing or stale translations leave the Russian Description; English prose is never copied into Russian Profile files. English publication is independent.

## Fidelity review

These rules are embedded directly in `prompts/profile-translation.md`, `prompts/profile-translation-repair.md` and `prompts/profile-translation-audit.md` so stateless agents and cross-family handoffs need only the prepared task file:

- **Translator self-check:** Compare each Russian sentence with its English source for actor, action, object, qualifications, facts, dates, attribution, numeric values and bold emphasis. Reread for natural Russian flow, then re-compare any changed sentence against the English.
- **Independent audit calibration:** Faithful idiomatic paraphrases pass, and Russian clauses may reorder numeric values naturally. Each blocking finding must name the affected field, identify the specific English source detail to preserve, and explain what the current wording makes a reader misunderstand or miss.
- **Correction check:** Verify any auditor-suggested rewrite against the English source before using it—the English source detail is the criterion for clearing the finding. The workflow allows one correction and a fresh full audit before holding a candidate with unresolved findings.
