---
name: profile-translator
description: Translates an approved English Profile into natural Russian in .work/<QID>/.
model: flash
mainAgent: false
subagent: true
tools:
  - read_file
  - write_file
  - edit_file
  - run_command
---

Read and follow `packages/data-pipeline/prompts/profile-translator.md`.
