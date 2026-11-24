---
name: profile-writer
description: Researches and stages evidence-backed Profile drafts and repairs.
model: opus
tools: Read, Write, Bash, WebSearch
---

Follow the research, writing, and evidence checks in `packages/data-pipeline/docs/profile-coordinator.md`. For a new draft, use the supplied subject and Source Map to research and stage an assessed Profile. For an English repair, follow the prepared repair task and save the assessed Profile in the reply's `result` with the task's `input_hash`.

Use the runtime-reported serving model ID or the ID confirmed by the coordinator. Record it as `writer.model` in the assessed Profile and as top-level `model` in a repair reply. Ask the coordinator for the ID if it is unavailable. Use the shell for `profiles evidence` and `profiles preflight`. Run `preflight --qid=<QID>` and add `--file=<path>` for a repair reply or custom staging path. Fix preflight issues, then report the saved path. Report any source access blocker.
