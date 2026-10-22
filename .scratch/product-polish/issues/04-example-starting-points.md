Type: grilling
Status: resolved
Blocked by: 01, 03

## Answer

Four **Starting Points**, each a single **Entity Link** (`/timeline/?e=<id>`) — no viewport or filter preset, since the URL carries only the entity. All load at `Mainstream`; Muhammad is excluded (audit finding 13); whether `DetailPanel` shows a figurative depiction at all is a separate content-policy call for the spec.

| Entity | Id | Kind | Era | Teaser |
|---|---|---|---|---|
| Cleopatra | `60827` | person | 68–29 BCE | Egypt's last pharaoh, caught between Caesar, Augustus and the birth of the Roman Empire. |
| Christopher Columbus | `5635` | person | 1451–1506 | The age of exploration, with Vasco da Gama and Magellan setting sail while Leonardo paints. |
| French Revolution | `Q6534` | conflict | 1789–1799 | A decade that remade Europe, with Napoleon rising and Beethoven composing. |
| Titanic | `Q25173` | milestone | 1912 | April 1912, two years before the First World War, with Einstein, Curie and Edison still at work. |

- **Maintenance:** hand-picked static list, teaser copy in the message catalogs. A test run after each dataset regeneration asserts every id still resolves at `Mainstream` and fails the build otherwise.
- **Russian:** the same four ids serve `/ru/`; only titles and teasers are translated, flagged for the Russian parity pass.

## Question

Which 3–4 example starting points does the landing page offer, and what does each open?

- Selection criteria: each must demonstrate the "aha" (overlapping lives plus surrounding events) in one glance, and cover different eras/regions so the dataset's range shows.
- For each: title/teaser copy, the exact viewport and selected entity it deep-links to (using the URL state from the routes ticket), and any filter preset.
- Whether examples are hand-picked static links or generated from data, and how they survive dataset regeneration (the dataset is pipeline-rewritten).
- Whether the same set serves Russian or the set is locale-specific (parity is fog; decide only whether to ticket it).
