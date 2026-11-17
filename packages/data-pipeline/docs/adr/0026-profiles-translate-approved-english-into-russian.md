---
status: accepted
---

# Profiles translate approved English into Russian

Russian Profile files previously copied English prose. Translate the fact-checked English Profile offline after verification, then use a separate model call to audit fidelity and natural Russian. This shares the historical evidence work while checking the additional risks introduced by translation: changed dates, names, attribution, uncertainty and causal claims.

Store a generated Russian translation sidecar beside the English raw Profile, bound to its exact content and identity, a translation-policy version, the translated fields and audit. Mechanical checks require complete field coverage, preserved digits and bold emphasis, and Russian prose. Structure, source URLs, legend flags and Connection identities stay with the English source; Connection names resolve from the Russian dataset. Translation never grants approval to the English source.

`verify` translates approved or already-current English Profiles automatically; `translate` backfills or retries independently. Audit defects allow one correction attempt followed by another complete audit, after which remaining defects hold the translation. API and session execution share the same gate. Output reads committed approvals without model or network calls. A missing, held or stale translation leaves the Russian Description available; Russian output no longer copies the English Profile. English remains publishable independently. Reusing a translation after changing its source would require a new fidelity audit, so edits invalidate it automatically.
