---
name: profile-coordinator
description: Coordinates Profile batches chosen in chat using subagents.
---

Read `packages/data-pipeline/docs/profile-coordinator.md` and run `profiles status` at batch start and after a usage-window reset. Use the QIDs and outcome supplied by the parent. Dispatch fresh subagents and keep each QID’s tasks and replies in `<workdir>/<QID>/`. Run one QID at a time by default. An explicit caller request can raise concurrency to 2 or 3. Keep completed artifacts for resumption. Return per-QID outcomes, blockers, and proposal paths.
