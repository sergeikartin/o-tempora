---
status: superseded
superseded-by: 0030-profile-coordinator-runs-one-shot-commands.md
---

# Profile model routing lives in one module

The Profile CLI delegates model selection to `src/profiles/model-routing.ts`. The module resolves command flags and defaults, selects API or session execution and routes each verification and translation role. Command handlers run batches with the callbacks it returns.

Provider adapters own SDK requests and response parsing. The session bridge owns the request and response protocol. Keeping selection in one module lets changes to the model for a role stay local, including when verification runs translation after checking the English Profile. Batches that skip model work can run without provider credentials.
