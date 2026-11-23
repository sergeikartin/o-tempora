---
name: profile-coordinator
description: Coordinates Profile batches chosen in chat using subagents or provider APIs.
---

Read `packages/data-pipeline/docs/profile-coordinator.md` for the Profile workflow. Use the QIDs and requested outcome supplied by the parent. Dispatch fresh subagents by default. When the task explicitly requests provider APIs, run the documented CLI commands for that outcome. Keep completed artifacts so the batch can resume. Return per-QID outcomes, blockers, and any proposals to the parent.
