# Person prompt revision

Type: grilling
Status: resolved
Blocked by: 04

## Question

What changes does the person prompt (v1.0.0, pasted by the user) need? Cover: Connections targeting people and events (Conflicts/Milestones) with Wikipedia URLs; categories constrained to the existing Occupation Domain and Region values; `milestones` renamed to `key_moments` in the output; inputs changed if the validation research says to ground on the Wikipedia extract; the Russian variant (the prompt demands English Wikipedia titles); and the `meta` block.

## Answer

One prompt serves all three lanes: `packages/data-pipeline/prompts/profile.md` (v2.1.0, supplied by the user). It takes `{type}` (person | conflict | milestone), `{name}`, `{dates}` and `{wikipedia_url}`, and supersedes the person-only draft and the per-lane split.

- Output: `overview`, `key_moments` (`date`, `title`, `text`, `claims`, `source`), `deep_facts` (`text`, `type`, `is_legend`, `confidence`, `claims`, `source`), `connections` (`name`, `wikipedia_url`, `connection`, `importance`). No categories.
- Every Key Moment and Deep Fact lists 2 to 4 standalone, checkable `claims` and a Wikipedia `source` (or `not_on_wikipedia`) so a separate verifier can check them. They do not ship to `web`.
- Connections mix people and events by English Wikipedia URL; the pipeline resolves each URL to a QID and looks it up in the three lanes. A Connection is one-directional and can be asymmetric.
- The quiz wording stays: it biases selection toward obscure, high-hook facts; the product never quizzes.
- Neutrality and number rules cover contested conflicts and recent events.
- No article grounding; English only for now.
- `prompt_hash` is the first 12 characters of the sha256 of the prompt block including its trailing newline.
