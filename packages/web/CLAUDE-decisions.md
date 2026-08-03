# packages/web — Decisions

<!-- Package-specific architecture decisions. Product scope and invariants: ../../CLAUDE-decisions.md -->

### Stack

| Layer | Technology |
|---|---|
| UI framework | React + TypeScript, mini-FSD |
| Build tool | Vite |
| Timeline rendering | vis-timeline (standalone build) |
| Styling | CSS Modules |
| Testing | Vitest + RTL |
| Lint / boundary tooling | ESLint + typescript-eslint + Steiger, enforcing mini-FSD boundaries |

### System Boundaries

- Frontend layering (mini-FSD): `shared → features → widgets → app` (no `entities`/`pages`). `shared/` holds business-agnostic logic and type re-exports; `features/` holds independent user-facing behaviors (fame-tier, occupation filter, region filter, entity selection); `widgets/` composes shared+features (`timeline-canvas`, `filter-bar`, `detail-panel`); `app/` is the entry point.

### Architecture Decisions Log

- `HistoricalEvent.category === "invention"` is the (implicit, not type-enforced) signal for which lane an event belongs to — no separate lane field exists.
