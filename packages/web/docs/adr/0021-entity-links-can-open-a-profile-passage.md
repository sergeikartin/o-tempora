---
status: accepted
supersedes: 0019-url-carries-one-entity-and-arrival-fits-it.md
---

# Entity Links can open a Profile passage

A Curiosity can lead visitors straight to the Key Moment or Deep Fact that explains it. The Landing Page action opens its designated lead entity in the timeline for the same Locale. The link uses `?e=<slug>` and can append a Profile Anchor, `#moment-<n>` or `#fact-<n>`, with a one-based position within that section. The Landing Page action is the only UI that creates these fragments. The hash on the Landing Page itself identifies the active Curiosity.

An Entity Link uses the first non-empty `e` value and normalizes it to a single slug. Selection navigation loads deeper dataset levels as needed, raises Detail Level to include the target, and fits its span with 10% padding per side within the zoom bounds and clear of the desktop drawer. An unresolved slug clears the Selection and its URL state. See [Selection navigation](0020-selection-navigation-owns-target-resolution.md) for target resolution.

After the Profile loads, the panel highlights the matching passage and scrolls it into view in the desktop drawer or mobile sheet. Scrolling is instant when reduced motion is enabled. The entity opens normally when the fragment is invalid, the passage is absent, or the Profile is unavailable. The timeline language switch carries the slug.

Mark clicks and Search picks keep the current zoom. A pick from a closed panel pushes a history entry. Later picks and closing replace the current entry. A Connection keeps the source open while its target loads, then pans at the current zoom and pushes a new entry. Selecting a different entity or closing clears the anchor from the current URL. Browser history re-resolves the Entity Link and restores its anchor when present.

On desktop, an open detail drawer adds its width as pan space past the present. Outside presses are hit-tested at the pointer position because canvas pointer capture can retarget the release.
