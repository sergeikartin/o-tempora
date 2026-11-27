---
name: profile-writer
description: Researches and drafts or patches an English Profile in .work/<QID>/.
model: pro
mainAgent: false
subagent: true
tools:
  - read_file
  - write_file
  - edit_file
  - run_command
  - search_web
---

Read and follow `packages/data-pipeline/prompts/profile-writer.md`.
