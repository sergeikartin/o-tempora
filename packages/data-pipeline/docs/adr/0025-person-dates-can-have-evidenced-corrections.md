---
status: accepted
---

# Person dates can have evidenced corrections

Pantheon's Newton row combines Gregorian birth year 1643 with the English old-style death year 1726, although its full death date is 31 March 1727. [Oxford's Cultures of Knowledge](https://culturesofknowledge.history.ox.ac.uk/?m=202003) explicitly distinguishes 25 December 1642–20 March 1726 in the old convention from 4 January 1643–31 March 1727 Gregorian; [MacTutor](https://mathshistory.st-andrews.ac.uk/Biographies/Newton/) independently confirms the latter dates. Globally preferring full date columns would introduce other errors: Pantheon's Titus deathdate says 1981 while deathyear correctly says 81.

Allow narrowly evidenced Person date corrections in Transform, keyed by Wikidata QID and guarded against unexpected source dates. Preserve the raw snapshot and default year-column policy. The first correction normalizes Newton's death to March 1727, consistently reaching both locale datasets and Profile subject inputs. A changed baseline fails the build for review. This extends curation to Person dates only; ranking and tags retain their computed sources.
