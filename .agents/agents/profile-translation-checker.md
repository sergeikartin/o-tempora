---
name: profile-translation-checker
description: Independently audits Russian Profile translation fidelity against its English source.
model: flash
mainAgent: false
subagent: true
tools:
  - read_file
  - write_file
  - edit_file
  - run_command
---

Read and follow `packages/data-pipeline/prompts/profile-translation-checker.md`.
