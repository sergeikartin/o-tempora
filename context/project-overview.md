# Project Overview: World History Timeline

## Overview

A read-only, continuously zoomable visualization of world history, inspired by history-timeline / Map of Contemporaries and Wait But Why's "Horizontal History." The app renders a single horizontal timeline spanning roughly 800 BCE to the present (extendable back toward 3000 BCE), across three lanes: notable people as horizontal bars spanning their birth and death years; wars, battles, treaties, and related conflict history (wars as range bars spanning start/end, battles/treaties/etc. as points, linked to their parent war when Wikidata records that relationship); and discoveries/inventions as points. Users pan and zoom the timeline the way they'd pan and zoom a map, filter what's visible by occupation and geographic region, and control how many people are shown via a fame-tier selector. Clicking a person or event opens a lightweight tooltip with their name, dates, a short description, and a link to their Wikipedia page. All data is hardcoded ahead of time, sourced from Wikidata; there is no user-generated content, no accounts, and no editing.

## Goals

1. Help the primary user (and by extension, other users) learn world history by seeing whose lives overlapped in time, where they lived, and in what era's context.
2. Make the shape of history visually intuitive — at a glance, a user should be able to tell that, for example, Newton and Peter the Great were contemporaries, without memorizing dates.
3. Keep the experience approachable: no login, no setup, open the app and start exploring immediately.
4. Ship a working, well-scoped v1 rather than the full original vision (connections, comparison mode, geographic map view) — those are explicitly deferred, not abandoned.

## Core User Flow

1. User opens the app and lands on a default view centered on the 1800s, showing a 100-year window, at the default fame tier (top 200 people). The 1800s is a deliberate default (data-dense, broadly familiar era), not a placeholder.
2. The timeline shows three lanes: **People** (horizontal bars from birth to death year); **Wars & Conflicts** (wars as horizontal range bars from start to end year, battles/treaties/sieges/etc. as single points, shown as "part of" their parent war when Wikidata records that link); and **Events & Inventions** (single points — discoveries and inventions only).
3. User scrolls/drags to pan across time, and zooms in/out (mouse wheel or pinch) the way they would on a map, within bounded limits: **zoom in to a minimum 10-year window**, **zoom out to a maximum 250-year window**. There is no "see all of history at once" view in v1 — the full span is explored by panning across bounded windows, not viewed in a single screen. Zooming in increases the time resolution shown; it does not change which people are eligible to appear — that's controlled separately by the fame tier.
4. User adjusts the **fame tier selector** (e.g., top 200 / 300 / 400 / more) to control how many people/events are eligible to render, based on Wikidata sitelink count.
5. User applies **occupation filters** (e.g., science, politics, art, philosophy, war, invention, exploration, religion) and **region filters** (e.g., Europe, East Asia, South Asia, Middle East, Africa, Americas) via toggleable chips, narrowing what's visible within the current fame tier.
6. User clicks on a person's bar or an event's point. A tooltip/detail panel appears showing: name, birth–death years (or event date), a short description, and a link to the person or event's Wikipedia page.
7. User continues panning, zooming, and filtering to explore different eras, regions, or fields of activity.

## Features

### Timeline rendering
- Continuous pan and zoom across the full historical span, bounded between a 10-year minimum window (max zoom-in) and a 250-year maximum window (max zoom-out). The full historical span is never visible in a single screen; users explore it by panning across bounded windows.
- Default landing view: centered on the 1800s, showing a 100-year window.
- Three lanes: People (range bars, birth–death); Wars & Conflicts (wars as range bars, start–end; battles/treaties/etc. as point markers, "part of" their war when known); Events & Inventions (point markers, discoveries/inventions only).
- Automatic stacking of overlapping people/events within a lane so overlapping lifespans don't visually collide.
- Correct rendering of BCE dates alongside CE dates on a single continuous axis.

### Filtering
- Fame-tier selector (top 200 / 300 / 400 / more), ranked by Wikidata sitelink count.
- Occupation filter (multi-select, chip-based).
- Region filter (multi-select, chip-based; tag-based, not a geographic map).
- Filters apply only within the currently selected fame tier — a person excluded from the current tier is not reachable through filtering or search in v1.

### Detail view
- Click-to-open tooltip/panel per person or event.
- Fields shown: name, dates (birth–death, or single event date), short description, link to Wikipedia.
- No editing, notes, bookmarking, or other write actions.

### Data
- Hardcoded dataset, populated from Wikidata ahead of time (not fetched live per session).
- Per-person fields: name, birth year, death year, occupation tag(s), region tag(s), fame score (sitelink count), short description, Wikipedia URL, and — best-effort, only when Wikidata records a qualified term of office — one or more reign/term-of-office periods (start year, end year if known). Broad by design: any dated "position held" claim counts, not just literal monarch titles, since Wikidata has no single closed class for "ruler."
- Per-event fields: name, date, occupation/category tag, region tag, fame score, short description, Wikipedia URL, and — for the Wars & Conflicts lane only — an optional end date (wars only, making them a range instead of a point) and an optional parent-conflict name ("part of," e.g. a battle's war), when Wikidata records either.

## In Scope

- Continuous, map-like pan/zoom timeline covering world history (target span: ~800 BCE–present for v1, extendable toward 3000 BCE).
- People, Wars & Conflicts, and Events/Inventions lanes, all hardcoded from Wikidata.
- Fame-tier selector (200/300/400/more) driven by Wikidata sitelink counts.
- Occupation filter.
- Region filter (tag-based, not a rendered map).
- Click-to-view tooltip with name, dates, short description, and Wikipedia link.
- Read-only experience: no accounts, no login, no user-generated content.

## Out of Scope (v1)

- **Connections between people** (e.g., drawing lines to show relationships, mentorships, rivalries) — deferred.
- **A literal geographic map view** — geography is handled via region tags/filters only, not a second map-based visualization.
- **Any write functionality** — no bookmarks, no personal notes, no user accounts, no editing of data by end users.
- **Live/dynamic data fetching** — data is curated and hardcoded ahead of time, not queried live from Wikidata per session.
- **Search or lookup for people/events outside the current fame tier** — if someone doesn't rank within the selected tier, they are not discoverable in the app.
- **Rich per-entry content** — no embedded video, markdown notes, reading lists, or long-form articles (unlike the original mockup's sidebar); the detail view is a lightweight tooltip only.

## Success Criteria

V1 is done when:

1. A user can open the app with no setup and see a populated 100-year window centered on the 1800s on first load, with no login or configuration required.
2. Pan and zoom feel smooth (no visible stutter) with the full default dataset (top 200 people + events) loaded.
3. Zooming into a densely populated century (e.g., 1750–1950) renders overlapping lifespans in a readable, stacked layout without visual collision.
4. Switching fame tiers (200 → 300 → 400 → more) and toggling occupation/region filters updates the visible timeline correctly and without confusing lag.
5. Clicking any visible person or event reliably opens a detail tooltip with accurate name, dates, description, and a working Wikipedia link.
6. BCE and CE dates render correctly on the same continuous axis without errors or visual glitches.
7. The dataset (people + events, with all required fields: dates, occupation, region, fame score, description, Wikipedia link) is fully populated for at least the top 200 people and a comparable set of major events before launch.