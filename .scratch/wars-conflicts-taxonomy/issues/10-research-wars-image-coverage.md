# Research P18/Commons image coverage for the new Wars & Conflicts categories

Type: research
Status: resolved

## Question

The Dynamic tooltips map's image-sourcing research (`.scratch/dynamic-tooltips/research/image-sourcing.md`) explicitly excluded Wars & Conflicts — coverage was never checked. That exclusion is now reversed (see this map's Destination), so the same investigation needs running for the 9 surviving `ConflictCategory` values.

Reuse the exact methodology already proven out for People/Discoveries — don't re-derive the mechanism (`Special:FilePath?width=` thumbnailing, per-file `imageinfo`/`extmetadata` licensing, the `wdt:P18` claim) — only re-run the measurement:

- For each of the 9 categories (war `Q198`, battle `Q178561`, siege `Q188055`, military-operation `Q645883`, revolution `Q10931`, rebellion `Q124734`, coup-d'état `Q45382`, war-of-independence `Q1006311`, peace-treaty `Q625298`), measure live P18 coverage (`wdt:P31 wd:QXXX` direct instance-of, matching this pipeline's existing query methodology) **among items clearing that category's specialist floor of 70 sitelinks** (per the "Per-category sitelink fame-tier floors" ticket's answer) — not the full unfiltered corpus, since that's the population that will actually ship.
- Sample licensing on a representative subset per category the way the original research did (PD vs. CC BY/BY-SA mix), flagging if Wars & Conflicts subjects skew differently from People/Discoveries (e.g., more modern conflicts with living-photographer-copyrighted press photos, vs. historical portraiture).
- Confirm whether `wdt:P18` can be added as one more `OPTIONAL` clause to the per-category SPARQL queries the fetch-split ticket is building, mirroring how People/Discoveries' existing enrichment queries were extended (cheapest path, no new fetch pass) — or whether a standalone pass is warranted.

Report coverage % per category, licensing mix notes, and a recommended wiring approach (extend the per-category queries directly vs. a standalone batched pass).

## Answer

Full findings, reproducible queries, and citations:
[`research/wars-image-coverage.md`](../research/wars-image-coverage.md).

**Coverage** (live SPARQL, `COUNT(DISTINCT ...)`, items clearing sitelinks≥70
per category — a first-pass non-`DISTINCT` count was caught overcounting due
to items with multiple P18 values, e.g. Battle of Badr's 7 images, and
corrected; the fix reproduced the "Per-category sitelink fame-tier floors"
ticket's population numbers exactly, a strong cross-check): **89/91 = 97.8%**
overall. Per category: war 39/40 (97.5%), battle 16/16 (100%), siege 2/2
(100%), military-operation 6/7 (85.7%), revolution 11/11 (100%), rebellion
5/5 (100%), coup-d'état 1/1 (100%), war-of-independence 3/3 (100%),
peace-treaty 6/6 (100%). Only 2 items in the entire population lack a P18
claim (War on Terrorism — an abstract campaign concept; 2026 Iran War — a
very recent item, thin Wikidata coverage so far).

**Licensing** (Commons `imageinfo`/`extmetadata`, run against the **full**
89-item population, not a sample — cheap enough to do exhaustively at this
volume): 64.0% PD/no-attribution-required, 36.0% some CC variant requiring
attribution. Wars & Conflicts does skew differently from People/Discoveries,
but via **three** distinct mechanisms, not just "modern subjects have
copyrighted press photos": (1) genuine modern press/user photography of
post-1990 conflicts — the dominant driver, concentrated almost entirely in
`war` (48.7% attribution-required vs. 16-19% for battle/revolution/
peace-treaty); (2) Bundesarchiv's bulk CC BY-SA 3.0 de donation of WWII
photos (historical subject, modern institutional license, distinctive
"Bundesarchiv, Bild [ID]" attribution format); (3) modern Commons
contributors' original maps/diagrams/collages illustrating centuries-old
wars (Second Punic War, Peloponnesian War, Seven Years' War, etc.) — CC
because the *artifact* is recent, independent of the depicted event's age.

**Wiring recommendation**: extend the 9 per-category SPARQL queries directly
with `OPTIONAL { ?event wdt:P18 ?image }` (mirroring `events-enrichment.ts`'s
existing P18 extension for Discoveries) — no standalone SPARQL pass, since
each per-category query already is Wars' primary candidate-discovery query
and already inlines other `OPTIONAL` enrichment clauses (`country`,
`article`, `description`, `partOfLabel`). For `imageAttribution`, extend the
already-shipped `fetch-image-attribution.ts` with a third `wars` entry
alongside its existing `people`/`discoveries` keys — same generic
`batchedCommonsImageAttributionFetch` helper, no new machinery, cheap at
this lane's volume (89 imaged items vs. Discoveries' 121 / People's 3,672).
