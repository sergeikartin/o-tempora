Type: task
Status: ready-for-agent

Audit findings 6 and 9. Public copy avoids internal domain terms and says "conflicts", not "wars".

## Renames (EN)

| Current | New |
|---|---|
| Occupation filter heading "People" | **Occupation** |
| Pill "Institutions" | **Politics & Religion** |
| Pill "Public Figure" | **Public Figures** |
| Milestone Category Group "Social & Human Culture" | **Society & Culture** |

Detail Level names stay (`Legendary` / `Mainstream` / `Specialized` / `Deep Cut`) and gain the hint "How much to show, most famous first." The hint's placement follows the layout (tickets 09–10); until then show it as a line under the control and as the control's accessible description.

## Russian

Equivalents for all renames. The cryptic slider stops `Профи` and `Детали` get full level names. Drafted by Claude, reviewed by the owner before landing; check string lengths.

## Acceptance

- No old label remains in `messages/{en,ru}.json`, components or tests.
- `CONTEXT.md` (**Occupation Domain**, **Milestone Category Group**, **Detail Level** display names) and `packages/web/docs/design-tokens.md` (renamed palette entries) updated.
