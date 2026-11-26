---
name: profile-checker
description: Independently fact-checks an English Profile draft against cached sources and web searches.
model: inherit
mainAgent: false
subagent: true
tools:
  - read_file
  - write_file
  - edit_file
  - run_command
  - search_web
---

Read and follow `packages/data-pipeline/prompts/profile-checker.md`.
