# O Tempora

An interactive timeline of world history — People, Conflicts, and Milestones lanes, hardcoded ahead of time.

## Language

**Conflict Category**:
A curator-assigned classification for an entry in the Conflicts lane, such as war, rebellion or coup d’état.
_Avoid_: Category (bare — ambiguous with Milestone Category), occupation domain, tag, type (for this specific field)

**Container**:
A top-level Conflict that groups other entries in the Conflicts lane. The Napoleonic Wars, for example, contain the Peninsular War.
_Avoid_: parent war, umbrella war/conflict (for this specific mechanism — use Container)

**Tagline**:
A short Wikidata description shown below an entity’s name, such as “American physicist”.
_Avoid_: Description (a different field), subtitle, blurb

**Description**:
The Wikipedia lead paragraph shown in the detail panel when a **Profile** is unavailable.
_Avoid_: Summary, extract, blurb (bare — ambiguous with Tagline)

**Milestone Category**:
A curator-assigned classification for a Milestone, such as medicine and health or commerce and finance. Each belongs to one **Milestone Category Group**.
_Avoid_: Category (bare), conflict category (for this specific field), Discovery Category

**Milestone Category Group**:
One of two groupings of **Milestone Category** values, Science & Innovation and Society & Culture, used for the Milestones palette and filters.
_Avoid_: Category Group (bare — Milestones-only), Milestone Group

**Occupation Domain**:
A Pantheon occupation grouping for People, such as Arts or Sports, used for mark colors and the Occupation filter.
_Avoid_: Category, occupation category, conflict category, milestone category (for this specific field), Legend (the pills are a filter, not a color key)

**Region** (filter):
A UN M49 subregion used to tag and filter entities across all three **Lane**s. People are tagged by birthplace and place of death, while Conflicts and Milestones are tagged by the present-day regions associated with their countries.
_Avoid_: geography filter, area filter, macro-region/sub-region

**Mark**:
One entity’s visual representation on the timeline. A rounded line represents a period and a dot represents a point in time.
_Avoid_: Lifespan (that is `Person.lifespan`'s field name, not the rendered shape), marker, item (too generic)

**Selection**:
The single entity whose detail panel is open. It identifies the entity in an **Entity Link** and supplies the years for the **Focus Range**.
_Avoid_: comparison, multi-select, pinned entities, set of entities

**Fame Score**:
A numeric measure that determines which entities each **Detail Level** includes and places higher-scoring marks nearer the Year Axis. People use Pantheon HPI, and Conflicts and Milestones share a score based on Wikidata sitelinks and Wikimedia pageviews.
_Avoid_: Importance score, significance score, popularity score

**Lane**:
One of the three content divisions, People, Conflicts or Milestones. Conflicts and Milestones share a visual band on the timeline.
_Avoid_: track, Wars & Conflicts, Events & Inventions, wars, discoveries, events (as a lane name)

**Minimap**:
The overview and navigation control for the full pannable timeline. It shows **Row Depth** for People above the center line and Conflicts and Milestones below it, with a rectangle for the **Viewport Range**.
_Avoid_: Mountain Profile, density chart, sparkline (bare)

**Scrubber**:
The phone-width navigation strip with century ticks and a thumb showing the **Viewport Range**.
_Avoid_: mini-minimap, timeline bar, slider

**Top Bar**:
The strip above the timeline that holds **Search**, the **Detail Level** switch, buttons for the **Filters Panel** and **Help**, and the language switch.
_Avoid_: header, toolbar, navbar, sidebar

**Filters Panel**:
The panel for applying Occupation, Region, and Conflicts & Milestones filters. It opens from the **Top Bar** as a popover on desktop and a bottom sheet on phones.
_Avoid_: filter drawer, sidebar, filter menu

**Row Depth**:
The number of rows needed at a given time to fit the marks without overlap, measured from the Year Axis to the outermost occupied row.
_Avoid_: lane height (the pixel consequence), row count, stack depth

**Reference Scale**:
The fixed horizontal scale used to assign rows and calculate **Row Depth** for the **Minimap**.
_Avoid_: default zoom (the opening viewport itself), base scale

**Viewport Range**:
The span of years visible between the left and right edges of the timeline.
_Avoid_: current year, center year, hero year

**Focus Range**:
The years named in the heading above the timeline. It shows the **Selection**’s span when an entity is open and the **Viewport Range** otherwise.
_Avoid_: Viewport Range (that is the visible span, which the heading no longer always shows), selection span, hero year, title

**Locale**:
The language of the current page and its dataset, English or Russian, determined by the page URL.
_Avoid_: language build, language mode, translation (bare)

**Field Fallback**:
The rule that fills a missing Russian name, **Tagline** or **Description** with the English value for that field.
_Avoid_: translation fallback, default language, English fallback (as the primary term — the mechanism is per-field and general)

**Detail Level**:
The preset that controls how much the timeline shows by applying a minimum **Fame Score** per **Lane**. The four levels are Legendary, Mainstream, Specialized and Deep Cut.
_Avoid_: Data Depth, Payload Tier, Fame Tier, Fame Level

**Search**:
A case-insensitive substring search of entity names and **Tagline**s across the three **Lane**s and all **Detail Level**s, within the active **Locale** and filters. Picking a result opens it as the **Selection** and raises the **Detail Level** when needed.
_Avoid_: filter (bare — Search narrows within the filters, it isn't one), lookup, autocomplete

**Landing Page**:
The introductory page at the root of each **Locale**. It shows one **Curiosity** at a time and offers a single action to open that Curiosity’s lead entity in the timeline.
_Avoid_: home page (ambiguous with the language switcher), splash, intro, onboarding

**Slug**:
The readable entity identifier in an **Entity Link**, such as `cnut-the-great`. It is unique across all three **Lane**s and shared across **Locale**s.
_Avoid_: permalink, handle, key (bare — ambiguous with `id`)

**Entity Link**:
A timeline URL that opens one entity as the **Selection** and fits the timeline to its span. It can also carry a **Profile Anchor**.
_Avoid_: deep link, permalink, share link, shareable state

**Profile Anchor**:
An optional passage reference on an **Entity Link** that takes the visitor to one **Key Moment** or **Deep Fact** in the selected entity’s **Profile**.
_Avoid_: Entity Link (the whole URL), Curiosity hash (a different landing-page state)

**Curiosity**:
A hand-picked historical coincidence shown on the **Landing Page** as a sentence and dated marks. One of those marks is the designated lead for opening the timeline.
_Avoid_: starting point, example, demo, tour (curated narrated tours are out of scope), fun fact

**Profile**:
A piece about one Person, Conflict, ConflictEvent or Milestone, with an overview, **Key Moments**, **Deep Facts** and **Connections**. It replaces the **Description** when available in the visitor’s **Locale**.
_Avoid_: Description (a different field — Wikipedia's lead paragraph), bio, extract, summary, page

**Key Moment**:
A dated episode in a **Profile**, presented with a short title and paragraph.
_Avoid_: milestone (bare — a lane), highlight, chapter

**Deep Fact**:
A little-known, documented detail in a **Profile** that helps a newcomer understand or remember the subject. Legends carry a label.
_Avoid_: fun fact, trivia, Curiosity (a different thing — a Landing Page overlap)

**Connection**:
A reference from a **Profile** to another entity, with a one-sentence reason it matters. Following it opens the target and lets the visitor retrace the path with Back.
_Avoid_: link (bare — ambiguous with **Entity Link**), relation, related, reference

**Help**:
The panel visitors open to learn how to read and navigate the timeline or to reach the About and language links.
_Avoid_: tutorial, onboarding, tour, coach marks, FAQ

**Empty Lane**:
A **Lane** with no visible **Mark**s in the **Viewport Range**. Its empty state explains whether filters or the current **Detail Level** limit what is shown.
_Avoid_: no results (that is **Search**'s own empty state), blank lane
