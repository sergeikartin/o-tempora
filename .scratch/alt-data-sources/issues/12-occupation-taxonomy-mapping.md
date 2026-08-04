Type: grilling
Status: resolved

## Question

Pantheon's `occupation` field is a single flat 101-category list (e.g. `SOCCER PLAYER`, `POLITICIAN`, `PHYSICIST`) with no domain/industry hierarchy — see [Pantheon schema research](../issues/05-research-pantheon-schema.md). This app's existing `Category` enum has only 8 values (`science, politics, art, philosophy, war, invention, exploration, religion`, `packages/shared-types/src/index.ts:6-15`) and no "sports" bucket, despite sports occupations (SOCCER PLAYER + ATHLETE alone) being ~34,000 of 126,582 rows — the single largest occupation cluster in the dataset.

How should the 101 Pantheon occupation values map onto `Category`? Does `Category` need a new "sports" value added, and who owns building/maintaining the 101-value mapping table (mirrors the existing occupation-mapping-backlog pattern already open for Wikidata QIDs per `CLAUDE-activeContext.md`'s Open Questions)?

## Context

Blocks: People-lane Tag stage design for the Pantheon switch.

## Research addendum

Pantheon's site (not the CSV) exposes a "Working in" filter combobox on https://pantheon.world/explore/rankings that groups the 101 occupation values into **8 domains** (verified count matches the CSV's 101 exactly):

- **Sports** (33): Soccer Player, Athlete, Basketball Player, Cyclist, Tennis Player, Wrestler, Swimmer, Racing Driver, Skier, Hockey Player, Boxer, Handball Player, Skater, Gymnast, Coach, Chess Player, Fencer, Volleyball Player, Martial Arts, Badminton Player, Cricketer, Referee, Rugby Player, Baseball Player, Table Tennis Player, Golfer, American Football Player, Snooker, Mountaineer, Poker Player, Gamer, Go Player, Bullfighter
- **Institutions** (8): Politician, Religious Figure, Military Personnel, Nobleman, Diplomat, Pilot, Judge, Public Worker
- **Arts** (17): Actor, Singer, Musician, Film Director, Painter, Composer, Architect, Sculptor, Comic Artist, Photographer, Artist, Conductor, Dancer, Comedian, Designer, Game Designer, Fashion Designer
- **Humanities** (6): Writer, Philosopher, Historian, Journalist, Linguist, Critic
- **Science & Technology** (18): Biologist, Mathematician, Physicist, Physician, Astronomer, Chemist, Inventor, Economist, Engineer, Computer Scientist, Psychologist, Archaeologist, Anthropologist, Geologist, Geographer, Sociologist, Political Scientist, Statistician
- **Business & Law** (3): Businessperson, Lawyer, Producer
- **Public Figure** (14): Social Activist, Companion, Model, Celebrity, Extremist, Pornographic Actor, Presenter, Mafioso, Youtuber, Occultist, Pirate, Chef, Magician, Inspiration
- **Exploration** (2): Astronaut, Explorer

This doesn't map cleanly onto this app's existing `Category` enum (`science, politics, art, philosophy, war, invention, exploration, religion`). Only `art`≈Arts and `exploration`≈Exploration line up 1:1 as whole domains. The rest of the app's categories are specific occupations Pantheon nests *inside* a broader domain rather than domains of their own: Religious Figure, Military Personnel, Nobleman, and Politician all sit together under "Institutions"; Inventor sits inside "Science & Technology" next to Physician and Engineer. Pantheon's "Institutions", "Humanities", "Science & Technology", "Business & Law", "Public Figure", and "Sports" have no existing `Category` counterpart at all.

## Answer

**`Category` is genuinely shared** between `Person` and `HistoricalEvent` (`packages/shared-types/src/index.ts:17,41-42,76`) — `HistoricalEvent.category` uses values like `war`/`invention` as event *type*, which don't fit Pantheon's occupation-domain structure at all (a war isn't "Public Figure"). Decision: **split into two types.**

- **`Category`** stays exactly as-is (`science, politics, art, philosophy, war, invention, exploration, religion`), used only by `HistoricalEvent.category` going forward.
- **New type, `OccupationDomain`**, replaces `Person.category`/`Person.occupationTags`, carrying Pantheon's 8 domains (kebab-case per this codebase's existing `Region`-enum convention): `sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration`.

This is a `packages/shared-types` change affecting both `packages/web` and `packages/data-pipeline` — bigger than this map's original Fetch-stage-only destination, but a direct, necessary consequence of the People-source decision ([People source: Pantheon](../issues/01-people-source-pantheon.md)) already made. Flagging for whoever implements: `Person.occupationTags` is an array today (Wikidata could map a person to multiple category tags), but Pantheon's CSV has exactly one flat `occupation` field per person — so under the new model `occupationTags` would always resolve to a single-element array. Whether to keep the array shape (for consistency/future-proofing) or collapse to a singular `occupationDomain: OccupationDomain` field is an implementation-shape detail, not decided here.

**Full 101-value mapping** (verified against the live `occupation` field, grouped by Pantheon's own "Working in" filter):

| `OccupationDomain` | Pantheon `occupation` values |
|---|---|
| `sports` | Soccer Player, Athlete, Basketball Player, Cyclist, Tennis Player, Wrestler, Swimmer, Racing Driver, Skier, Hockey Player, Boxer, Handball Player, Skater, Gymnast, Coach, Chess Player, Fencer, Volleyball Player, Martial Arts, Badminton Player, Cricketer, Referee, Rugby Player, Baseball Player, Table Tennis Player, Golfer, American Football Player, Snooker, Mountaineer, Poker Player, Gamer, Go Player, Bullfighter |
| `institutions` | Politician, Religious Figure, Military Personnel, Nobleman, Diplomat, Pilot, Judge, Public Worker |
| `arts` | Actor, Singer, Musician, Film Director, Painter, Composer, Architect, Sculptor, Comic Artist, Photographer, Artist, Conductor, Dancer, Comedian, Designer, Game Designer, Fashion Designer |
| `humanities` | Writer, Philosopher, Historian, Journalist, Linguist, Critic |
| `science-technology` | Biologist, Mathematician, Physicist, Physician, Astronomer, Chemist, Inventor, Economist, Engineer, Computer Scientist, Psychologist, Archaeologist, Anthropologist, Geologist, Geographer, Sociologist, Political Scientist, Statistician |
| `business-law` | Businessperson, Lawyer, Producer |
| `public-figure` | Social Activist, Companion, Model, Celebrity, Extremist, Pornographic Actor, Presenter, Mafioso, Youtuber, Occultist, Pirate, Chef, Magician, Inspiration |
| `exploration` | Astronaut, Explorer |
