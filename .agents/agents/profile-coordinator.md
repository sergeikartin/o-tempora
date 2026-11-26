---
name: profile-coordinator
description: Coordinates English Profile authoring and verification batches chosen in chat using subagents.
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

Read and follow `packages/data-pipeline/docs/profile-coordinator.md`.
