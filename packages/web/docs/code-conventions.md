# packages/web — Conventions

<!-- Frontend code patterns. Read before implementing features. -->

## Code Standards

- FSD layer and public-API boundaries are enforced by Steiger in CI — a violation fails the build, not a style suggestion.

### React (mini-FSD)

- Layers: `shared → features → widgets → app` (`entities`/`pages` deliberately omitted — single-domain, single-page app). A layer may only import from layers below it.
- Each slice exposes one public `index.ts`; other code never reaches into a slice's internals.
- Functional components only. D3's DOM manipulation is client-only — never assume it can server-render.
- Filter/selection state lives in the feature slice it belongs to; no global state folder.

### Styling

- CSS Modules only; one base/reset file is the sole global stylesheet. Co-locate a component's `.module.css` with its component file.
- No hardcoded hex — color/typography/radius come from tokens (`docs/design-tokens.md`) as CSS custom properties. Prefer to use CSS variables.
- Occupation category colors are the single source of truth across People-lane lines, Events-lane marker borders, and the matching filter chip — one palette, never per-surface copies.
- Shape, not color, carries Period vs. PointInTime, the same rule across all three lanes: a rounded-cap line for a real duration, a dot for a single moment. Person vs. event is instead carried by lane, label position, and palette — never by color alone.
- Never use CSS Modules class names as JS/test hooks (query by role/text or a dedicated `data-*` attribute instead) — the same reason D3 joins in this widget key off literal marker classes, not CSS-Module classes.

### Timeline Rendering (D3)

See `docs/timeline-rendering.md`.

### Data and Storage

- Filter/selection/viewport state is in-memory only, owned by its feature slice.

### File Organization

- Organized by mini-FSD layer under `src/`. Cross-widget state (fame-score filter values, selected-entity reference) is lifted to `app/` and threaded down as props; every other feature owns and calls its own state hook internally.
