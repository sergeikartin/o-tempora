Type: grilling
Status: resolved

## Question

Should the People lane's Fetch stage switch from Wikidata SPARQL to Pantheon 2.0, and if so, is a Wikidata QID crosswalk required to preserve the existing QID-keyed occupation/region tagging approach?

## Answer

Pantheon fully replaces Wikidata as the People-lane source — not a hybrid. Losing the Wikidata QID is acceptable; no crosswalk is required. Occupation and region tagging for People will be taken directly from Pantheon's own fields instead of the existing QID-keyed lookup table, making that lookup-table approach lane-specific (still applies to Wars/Events, which stay Wikidata-keyed) rather than pipeline-wide as currently documented in `packages/data-pipeline/CLAUDE.md`.

Exact Pantheon field names/shape for occupation and region are unconfirmed — see the Pantheon schema research ticket.
