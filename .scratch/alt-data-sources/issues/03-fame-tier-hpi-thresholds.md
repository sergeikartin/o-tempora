Type: grilling
Status: resolved

## Question

If People moves to Pantheon, what replaces the current sitelink-count-based fame-tier system (`FAME_TIER_MIN_SITELINKS`: generalPublic/educated/specialist)?

## Answer

Fame tiers bind to Pantheon's HPI (Historical Popularity Index) instead of Wikidata sitelink counts, with floors 90/85/75. Exact tier-to-threshold mapping (current sitelink model has `specialist` as the lowest floor at 30) still needs to be confirmed once Pantheon's actual HPI field/scale is verified — see the Pantheon schema research ticket — but no separate threshold-setting ticket is needed beyond that confirmation.
