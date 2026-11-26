---
name: profile-translation-coordinator
description: Coordinates Russian Profile translation and fidelity audit batches for approved English Profiles using subagents.
model: inherit
mainAgent: true
subagent: true
tools:
  - read_file
  - write_file
  - run_command
  - invoke_subagent
  - manage_subagents
  - send_message
  - manage_task
---

Read and follow `packages/data-pipeline/docs/profile-translation-coordinator.md`.
