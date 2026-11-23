---
status: accepted
supersedes: 0010-search-stays-inside-active-filters-and-payload-tiers.md
---

# Search uses a localized index across Detail Levels

Search should find People, Conflicts and Milestones at any Detail Level. Fetching the full timeline datasets on the first query would bring descriptions, dates, images and row assignments into a request that only needs to match and filter results.

The pipeline emits one index per Locale with searchable fields, filter tags, Fame Scores and entity identifiers. It uses the same entities and Deep Cut floors as the timeline. The first non-empty query loads the current Locale’s index and the timeline caches it for the visit. Search applies the current Occupation, Region and Conflicts & Milestones filters.

Results below the current Detail Level identify the first level that includes them. When picked, Selection navigation waits for the required data, raises Detail Level as needed and pans to the selected mark. The existing Detail Level deltas continue to serve timeline rendering.
