# CLAUDE.md

<!-- Keep under 200 lines. If removing a line wouldn't cause mistakes, cut it -->
<!-- HTML comments like these are stripped from context at runtime — free for humans -->

## Project Overview

- Project Name: World History Timeline (npm package: `same-sky`)
- Tech Stack: React 19 + TypeScript + Vite + vis-timeline (frontend); Node.js + TypeScript (data pipeline); npm workspaces monorepo
- Description: Read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded from Wikidata. No accounts, no editing, no live data fetching

## Build, Test & Verify

Monorepo (npm workspaces): `packages/web` (frontend), `packages/data-pipeline` (offline data pipeline), `packages/shared-types` (shared types + generated data, no build step of its own).

- Install (from repo root): `npm install`
- Package-specific commands: `packages/web/CLAUDE.md` (dev/build/lint/test) · `packages/data-pipeline/CLAUDE.md` (fetch/build-data/test)

## Code Style & Conventions

- TypeScript strict mode throughout; avoid `any`
- `Temporal.PlainDate` is the canonical date type in both `packages/web` and `packages/data-pipeline`, everywhere except the single legacy-`Date` adapter in `packages/web`'s `widgets/timeline-canvas`
- Package-specific conventions (FSD layering, styling, pipeline stages): `packages/web/CLAUDE.md` · `packages/data-pipeline/CLAUDE.md`
- Full rules: `CLAUDE-patterns.md`

## Architecture

- `packages/web` — frontend: React + Vite + vis-timeline, mini-FSD, reads static JSON bundled at build time. Details: `packages/web/CLAUDE.md`
- `packages/data-pipeline` — offline pipeline (fetch → score → tag → output) that curates `packages/shared-types` datasets from Wikidata SPARQL; never runs at app runtime. Details: `packages/data-pipeline/CLAUDE.md`
- `packages/shared-types` — shared `Person`/`HistoricalEvent`/`Category`/`Region` types and generated `people.json`/`events.json`, imported by both packages so neither imports the other directly
- No backend, no database; the app never writes anywhere at runtime — full invariants in `CLAUDE-decisions.md`
- Full details: `CLAUDE-decisions.md`

---

## Core Rules

**Investigation & accuracy:**
- Never speculate about code you have not read. Read files and ripgrep for usages before making claims
- If the user references a file, read it before answering
- If uncertain, say so and propose how to verify. Do not fabricate APIs, paths, or behavior

**Scope discipline:**
- Do what has been asked; nothing more, nothing less
- When intent is ambiguous, default to research and recommendations — only edit when explicitly asked
- Make only the changes requested. Do not refactor adjacent code, add docstrings to unchanged code, or create abstractions for a single use
- Follow scoping words ("only", "just", "exactly") literally

**Verification & safety:**
- Before declaring done: re-check requirements, run tests and lint, state what changed and what you could not verify
- Ask before destructive or hard-to-reverse actions: deleting files/branches, force pushes, hard resets, --no-verify
- Edit existing files in place. Do not create new files unless required. Clean up scratch files

**Efficiency & tools:**
- Parallelize independent tool calls; serialize dependent ones
- Use `rg` not grep, `fd` not find. `tree` is not installed

**Project workflow & delivery** (these are rules, not suggestions — if a rule and a request conflict, stop and flag it rather than silently picking one):
- Work spec-first: read `CLAUDE-decisions.md` and `CLAUDE-patterns.md` in full before writing code for a unit of work; state in 1-2 sentences what you're building and which invariant(s) apply
- One unit of work per turn (one feature slice, one widget, one pipeline stage, or one bug fix); stop for review before starting the next — don't build ahead unasked
- No speculative changes: don't refactor unrelated code, rename files, cross mini-FSD layer boundaries, reintroduce a dropped layer (`entities`/`pages`), or touch `packages/data-pipeline` while working on `packages/web` (or vice versa) unless the task explicitly spans both
- Don't add a dependency not already listed in `CLAUDE-decisions.md`'s Stack table without flagging it first
- If a task spans more than one FSD layer, split it one layer per step in dependency order (`shared → features → widgets → app`); if a task spans both frontend and pipeline, split it into two units even if related
- If a requirement is missing, ambiguous, or conflicts with `CLAUDE-decisions.md`/`CLAUDE-patterns.md`, stop and ask — never invent scope or silently violate an invariant
- Never hand-edit `packages/shared-types/src/data/*.json` or `packages/data-pipeline/data/raw/` — both are pipeline-generated; fix the pipeline stage and regenerate
- If implementation reveals a documented decision is wrong or a new invariant emerges, update `CLAUDE-decisions.md`/`CLAUDE-patterns.md` in the same unit of work — don't leave docs stale
- Before calling a unit done: FSD layer direction respected, `Temporal.PlainDate` used everywhere but the one adapter, filters combine with AND never OR, no runtime Wikidata/API calls, Steiger passes, TypeScript strict is clean

---

## Memory Bank System

This project uses a dual-memory architecture for maximum resilience:

1. **`CLAUDE-*.md` files** (git-tracked, team-shared) — the primary memory bank
2. **Native auto memory** (machine-local, per-project) — a persistent shadow that survives CLAUDE.md resets

### Memory Bank Files

Read on demand — only load what your current task needs:

| File | Purpose | Read When |
|------|---------|-----------|
| CLAUDE-activeContext.md | Session state, current phase/goal, completed work, open questions | Always first at session start |
| CLAUDE-patterns.md | Code patterns, conventions, and UI/design tokens | Before implementing features or touching styling |
| CLAUDE-decisions.md | Product scope and architecture decisions (ADRs, invariants) | Before design or scope choices |
| CLAUDE-troubleshooting.md | Known issues and proven solutions | When debugging |
| CLAUDE-config-variables.md | Configuration variables reference | When touching config |
| CLAUDE-temp.md | Temporary scratch pad | Only when explicitly referenced |

All files are optional — check existence before reading. `context/specs/*.md` still holds the original per-unit implementation specs (unchanged by this file's migration to the `CLAUDE-*.md` naming) — read the relevant one when picking up a specific unit of work.

### Memory Bank Workflow

1. **Session start:** Read `CLAUDE-activeContext.md` for continuity
2. **During work:** Read `CLAUDE-decisions.md` / `CLAUDE-patterns.md` as needed
3. **After significant work:** Update `CLAUDE-activeContext.md` (new progress, open questions); update `CLAUDE-decisions.md` or `CLAUDE-patterns.md` in the same unit if the change affects architecture, scope, or conventions
4. **Sync to auto memory:** Mirror key updates into native auto memory topic files:
   - `memory/MEMORY.md` — index of memory bank files and their current state
   - `memory/patterns.md` — established code patterns (mirrors `CLAUDE-patterns.md`)
   - `memory/architecture.md` — architecture decisions (mirrors `CLAUDE-decisions.md`)
   - `memory/build-and-test.md` — build commands and verification steps
   - `memory/troubleshooting.md` — known issues (mirrors `CLAUDE-troubleshooting.md`)

### Why Dual Memory

| Aspect | CLAUDE-*.md (Memory Bank) | Auto Memory (MEMORY.md) |
|--------|---------------------------|--------------------------|
| Shared via git | Yes | No (machine-local) |
| Survives CLAUDE.md wipe | No | Yes |
| Survives `/init` re-run | No (may be overwritten) | Yes |
| Team members see it | Yes | No (personal) |
| Auto-loaded at session start | No (on demand) | Yes (first 200 lines) |
| Topic files on demand | N/A | Yes |

The memory bank is your team's shared truth. Auto memory is your personal safety net.

### Backups

`CLAUDE-*.md` files are normal git-tracked project files, committed like any other source — backed up via the repo's own git history and remote, no separate workflow needed. `.claude/` settings are machine-local; back those up separately if customized.

---

## Progressive Disclosure

| Layer | Location | Loads | Resilient |
|-------|----------|-------|-----------|
| Core rules & overview | This file | Always | Git-tracked |
| Auto memory index | MEMORY.md | Always (200 lines) | Machine-local |
| Auto memory topics | memory/*.md | On demand | Machine-local |
| Path-scoped rules | `.claude/rules/*.md` | When matching files | Git-tracked |
| User-level rules | `~/.claude/rules/*.md` | Always | Machine-local |
| Skills & workflows | `.claude/skills/` | On demand | Git-tracked |
| Personal overrides | `CLAUDE.local.md` | Always (gitignored) | Local only |
| Memory bank files | CLAUDE-*.md | On demand | Git-tracked |
| Package-specific rules | `packages/*/CLAUDE*.md` | When working in that package | Git-tracked |

Use `/memory` to see which files are loaded. Root CLAUDE.md survives `/compact`; subdirectory CLAUDE.md files reload when Claude next reads files there.

For libraries/frameworks, verify current APIs before implementing.
