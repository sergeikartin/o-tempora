# Code Conventions

<!-- Shared code conventions across both packages. Read before implementing shared/cross-package code. Package-specific conventions: packages/web/docs/code-conventions.md · packages/data-pipeline/docs/code-conventions.md -->

## Date handling
- use  JavaScript Temporal API for all dates in app

## Data and Storage

- No database, no backend. `packages/shared-types/src/data/*.json` is the only data the app reads, and it's always pipeline-generated — never hand-edited.


## Comments 
- NEVER add edit history, changelogs, diff descriptions, or ticket numbers to inline code comments.
- Do not document the "decision history" or trials of past modifications inside the code.
- Write code to be self-documenting; use comments only to explain complex logic "why", not "what changed".
