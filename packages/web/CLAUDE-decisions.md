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

- **Superseded, not yet updated in code**: this decision described `HistoricalEvent.category === "invention"` as the (implicit, not type-enforced) signal for which lane an event belongs to. The data-pipeline now splits Wars & Conflicts (`wars.json`, typed `War[]`) and Discoveries & Inventions (`discoveries.json`, typed `Discovery[]`) upstream, so this client-side category check becomes unnecessary once `packages/web` is updated to consume the two files directly — tracked in root `CLAUDE-activeContext.md`'s Open Questions. `packages/web` does not currently typecheck against `packages/shared-types` as of this change (`HistoricalEvent` no longer exists).
