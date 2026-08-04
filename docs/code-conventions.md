# Code Conventions

<!-- Shared code conventions across both packages. Read before implementing shared/cross-package code. Package-specific conventions: packages/web/docs/conventions.md · packages/data-pipeline/docs/conventions.md -->

## General
For TypeScript conventions, see docs/TYPESCRIPT.md

## Date handling
- use  JavaScript Temporal API for all dates in app

## Data and Storage

- No database, no backend. `packages/shared-types/src/data/*.json` is the only data the app reads, and it's always pipeline-generated — never hand-edited.
