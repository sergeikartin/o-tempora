# Landing Page without a multi-Selection

Type: grilling
Status: resolved
Blocked by:

## Question

What is a Curiosity, and what does the Landing Page's button do, once a Selection is one entity and the timeline can no longer show an overlap?

## Answer

A Curiosity stays a hand-picked coincidence, now Profile-led.

- The sentence, the axis figure and the shared-stretch band stay, drawn from the landing's own data. The band is landing-only.
- Each Curiosity has one `lead` entity. The call-to-action keeps a generic label and opens the lead's Entity Link (one `?e=`).
- The link ends in a URL fragment, `#moment-<n>` or `#fact-<n>`, resolved by the timeline's JavaScript: the panel scrolls that Key Moment or Deep Fact into view and gives it a persistent accent. Only those two sections are targets for now.
- The fragment is part of the link, but only the landing produces it. `entityLinkSearch` and the Entity Link stay one slug, so Connections, search jumps and share links never add one. Opening another entity drops it and clears the accent; Back restores both. A fragment with no Profile, an out-of-range index or an unknown kind is ignored and the panel opens normally.
- `anchor` is optional on a Curiosity. Most leads have no Profile yet and open the plain panel until theirs ships; the anchor is added then.
- `curiosities.test.ts` pins each anchor to an expected Key Moment date or Deep Fact phrase in the shipped Profile, so a regeneration that moves it fails the build.
- The per-mark Entity Links under the figure are removed (marks stay as plain labels), and so is the `landing_mark_open` event.
- Connections stay model-chosen and are never coupled to Curiosities.
