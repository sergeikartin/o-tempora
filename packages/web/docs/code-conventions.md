# packages/web — Conventions

<!-- Frontend code patterns. Read before implementing features. -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.
- Steiger excludes generated Paraglide files, including dotfiles, so boundary checks can run before or after localization generation.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. D3's DOM manipulation is client-only — never assume it can server-render.

### Styling

- CSS Modules only; one base/reset file is the sole global stylesheet. Co-locate a component's `.module.css` with its component file.
- No hardcoded hex — color/typography/radius come from tokens (`docs/design-tokens.md`) as CSS custom properties. Prefer to use CSS variables.
- Each lane's palette (Occupation Domain, Milestone Category Group, Conflict Color) is the single source of truth for its marks and its matching filter pill — never per-surface copies.
- Never use CSS Modules class names as JS/test hooks (query by role/text or a dedicated `data-*` attribute instead) — the same reason D3 joins in this widget key off literal marker classes, not CSS-Module classes.

### Timeline Rendering (D3)

Read [Timeline rendering](timeline-rendering.md) before changing D3 joins, scrolling, zoom or Selection navigation.

### Data and Storage

- Feature slices own filter, Selection and viewport state. Lift shared state to `app/` and pass it down as props. Keep filters and viewport state in memory.
- Load Profiles from the static same-origin path for the active Locale only when the selected entity has `hasProfile`. Keep the Description available as the missing or failed Profile fallback.
