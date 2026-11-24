---
status: accepted
supersedes:
  - 0030-profile-coordinator-runs-one-shot-commands.md
  - 0033-profile-adversarial-verification-and-heading-excerpts.md
---

# Profiles use conversation subagents

The coordinator dispatches fresh conversation subagents for writing, adversarial research, English audit and repair, Russian translation, and fidelity audit. One-shot CLI commands prepare tasks and apply replies bound to their inputs. The CLI owns evidence validation, mechanical checks, persistence and approval receipts. Direct provider execution would duplicate orchestration and prompt handling, so Profile commands use conversation subagents exclusively.

English verification retains heading-aware excerpts and checks up to five high-risk findings for counterevidence before the independent audit. The coordinator reuses saved checks across repairs when the passage path and claim hash match and cached counterevidence still validates. New reports use policy 7 with adversarial checks for selected findings. Historical English policies 2–7, including receipts with a recorded opt-out, and Russian policy 1 continue under their existing approval rules.

Batch status reads durable artifacts and gives each QID a next command. The coordinator defaults to one active QID and can run up to three on request, with per-QID working directories. Prefetch shares Wikipedia pacing and writes one blocked-host cache entry per host. Build and publish check Profile flags, files and Connection targets against the written locale datasets.
