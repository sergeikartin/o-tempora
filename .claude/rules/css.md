---
paths:
  - "**/*.css"
---
# CSS Coding Style

This project uses CSS Modules with custom properties for design tokens.

## Configuration
- CSS Modules for component-scoped styles
- One base/reset file as the sole global stylesheet
- Custom properties (CSS variables) for design tokens

## Conventions
- No hardcoded values (hex colors, magic numbers) — reference tokens via `var(--token-name)`
- Prefer logical properties (`margin-inline`, `padding-block`) over physical ones where direction-independence matters
- Use `rem` for typography, `px` for hairline borders, otherwise prefer relative units
- Class names in `camelCase` to match CSS Modules' JS import ergonomics

## Patterns
- Compose shared styles via CSS custom properties, not `@extend`/mixins
- Prefer flexbox/grid for layout over floats or absolute positioning
- Use `:is()`/`:where()` to reduce selector repetition and specificity conflicts
- Keep specificity flat — avoid deep selector nesting and ID selectors

## Code Style
- One selector block per rule; avoid comma-grouping unrelated selectors
- Order properties logically (positioning → box model → typography → visual) rather than alphabetically
- Use shorthand properties only when setting all sides/values intentionally

## File Organization
- Co-locate a component's `.module.css` file with its component file
- Never use CSS Modules class names as JS/test hooks (query by role/text or a dedicated `data-*` attribute instead)
