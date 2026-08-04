Type: grilling
Status: superseded by [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md)

## Question

Should the Wars & Conflicts lane adopt CDB90 as a data source, and is a hybrid/partial-lane split (CDB90 for its covered range, Wikidata for the rest) in scope, given CDB90 only covers 1600-1973?

## Answer

Yes to both. CDB90 (~600 battles, 1600-1973, global, public domain / ODC-BY license, cross-referenced to DBpedia and Correlates of War via `cow_warno`/`cow_warname`) is the lead Wars candidate, chosen over the Kaggle "World History of Wars and Demographics" dataset (see Out of scope on the map). Hybrid sourcing is in scope: CDB90 for 1600-1973, Wikidata for everything outside that range. CDB90 has no Wikidata QID column, only DBpedia links — losing the QID here follows the same reasoning as the People-lane decision (see People source decision).

Open: whether CDB90 exposes war-level start/end dates directly or these must be derived from per-battle dates within a war group — see the CDB90 war-range research ticket.
