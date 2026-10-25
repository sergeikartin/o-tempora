# Validating Profile correctness: evidence, options, recommendation

Research for ticket `.scratch/person-profiles/issues/04-validation-research.md`. Findings only; the decision belongs to the grilling tickets 02/03 that this unblocks.

Sources are first-party: MediaWiki / Wikidata / Anthropic docs and the papers' own arXiv pages. Facts about this repo come from files in it. Facts marked **[verified live]** were checked against the live Wikipedia / Wikidata APIs on 2026-10-25 (descriptive User-Agent, one request at a time). Anything marked **[estimate]** or **[inference]** is mine, not a sourced claim.

## 1. What has to be kept correct

A Profile (`CONTEXT.md`) holds an overview, Key Moments (a date, an essence, a paragraph), up to 3 Deep Facts (`confidence` high|medium, `is_legend`), categories, and Connections (Wikipedia URL plus a reason). The claims split into five kinds with different checkability:

| Claim kind | Machine-checkable against | Notes |
|---|---|---|
| Dates (Key Moment dates, life span in overview) | Pantheon `birthyear`/`deathyear`, Wikidata P569/P570, curated `year` for conflicts and milestones | Year-level only; see 3.2 |
| Connection target | Wikipedia title normalization, then QID, then dataset membership | Fully mechanical |
| Quotes, numbers, names in prose | Substring or token presence in the article text, if the article was supplied | Only if grounded |
| Narrative (what happened, why it mattered) | The article text via an LLM or a human | Not mechanical |
| Legend vs documented | Judgment | Self-reported by the model |

## 2. Evidence

### 2.1 Models are least reliable on exactly the facts Deep Facts want

- FActScore (Min et al., EMNLP 2023, arXiv:2305.14251) splits long-form biographies into atomic facts and scores the share supported by a reliable source. ChatGPT scored 58%. Its automated estimator (retrieval plus a strong LM) came within 2% of human-based scores.
- Mallen et al., "When Not to Trust Language Models" (ACL 2023, arXiv:2212.10511): models struggle with less popular facts and "scaling fails to appreciably improve memorization" of the long tail. Retrieval-augmented LMs substantially outperform much larger unassisted ones, while unassisted LMs stay competitive on high-popularity entities.
- Kalai et al., "Why Language Models Hallucinate" (2025, arXiv:2509.04664): hallucination arises partly because training and benchmarks reward guessing over admitting uncertainty.
- Implication **[inference]**: the first batch is Legendary entities (high popularity), so the overview and the main Key Moments are the safest memory content. A Deep Fact is by definition obscure, the long-tail case where memory fails most. Drift is most likely in Deep Facts, in precise dates and numbers inside Key Moment paragraphs, and in Connection reasons for lesser entities.

### 2.2 Anthropic's guidance for factual tasks

From "Reduce hallucinations" (platform.claude.com, `test-and-evaluate/strengthen-guardrails/reduce-hallucinations`):

- Give permission to say "I don't know"; this "can drastically reduce false information".
- For long documents, extract word-for-word quotes first and answer only from them.
- Verify after generation: "find a supporting quote after it generates a response. If it can't find a quote, it must retract the claim."
- Restrict the model to the provided documents and not its general knowledge.
- Best-of-N: run the same prompt several times and treat inconsistency as a hallucination signal.
- The page's own caveat: these techniques "significantly reduce hallucinations, they don't eliminate them entirely."

### 2.3 Citations API: useful, but it conflicts with the prompt's JSON output

From "Citations" (platform.claude.com, `build-with-claude/citations`):

- All active models support citations. Plain-text documents are chunked into sentences and citations carry 0-indexed character ranges.
- "citations are guaranteed to contain valid pointers to the provided documents" and `cited_text` does not count toward output tokens. That guarantees the pointer exists in the source, not that the claim follows from it.
- **Citations cannot be combined with structured outputs.** Enabling citations on a `document` block together with `output_config.format` returns a 400 error, because citation blocks interleave with text and the JSON schema constraint forbids that.
- Implication **[inference]**: the Profile prompt returns structured JSON, so either (a) skip the Citations API and have the JSON carry an `evidence` field holding a verbatim quote that the pipeline verifies itself (section 3.3), or (b) use citations in a free-text first call and structure it in a second call. (a) is simpler and keeps a single call.

### 2.4 Verifier-based approaches in the literature

- SAFE (Wei et al., NeurIPS 2024, arXiv:2403.18802): an LLM splits a response into facts and checks each with search. It agreed with crowdsourced human annotators on about 72% of ~16k facts, and was right in 76% of 100 sampled disagreements. It was "more than 20 times cheaper than human annotators."
- Chain-of-Verification (Dhuliawala et al., 2023, arXiv:2309.11495): draft, plan verification questions, answer them independently so the draft does not bias the answers, then revise. Reported reductions on Wikidata list questions, closed-book MultiSpanQA and long-form generation. The abstract gives no effect sizes.
- SelfCheckGPT (Manakul et al., EMNLP 2023, arXiv:2303.08896): sample several times and check consistency, with no external source: "if an LLM has knowledge of a given concept, sampled responses are likely to be similar and contain consistent facts." Evaluated on GPT-3 WikiBio passages.
- Kadavath et al., Anthropic, "Language Models (Mostly) Know What They Know" (arXiv:2207.05221): larger models are well calibrated on proposing an answer and rating P(True), and self-evaluation improves when the model sees many of its own samples. They "struggle with calibration of P(IK)" on new tasks. Self-reported confidence is informative but not a gate.
- Panickssery et al., "LLM Evaluators Recognize and Favor Their Own Generations" (arXiv:2404.13076): evaluators prefer their own outputs, and self-recognition correlates with the preference. A verifier that is the same model as the writer carries bias.
- Common limit **[inference]**: all of these estimate faithfulness to a source or the model's own consistency. Consistent errors, such as a popular misconception the model learned, pass SelfCheck, and a model verifying from memory shares the writer's blind spots.

### 2.5 What Wikipedia and Wikidata give the pipeline

- **MediaWiki API etiquette** (mediawiki.org `API:Etiquette`): reads have no hard limit, but send requests serially. Set a descriptive User-Agent. Use `maxlag` for non-interactive jobs. Batch with `|`. On `ratelimited`, back off exponentially. This offline job fits comfortably.
- **Title resolution** (`API:Query`): `redirects` follows redirects and reports them in a `redirects` array; titles are normalized (`normalized` array); missing titles get a `missing` flag and invalid ones `invalid`; up to 50 titles per query. `API:Pageprops` shows `pageprops` returning `wikibase_item` (its example returns `Q937` for Albert Einstein), so title to QID is one batched call.
- **TextExtracts** (`Extension:TextExtracts`): `exintro` limits the extract to the lead; `explaintext` gives plain text; the page does not state whether omitting `exintro` returns the full article (my inference, confirmed live below). The page says the extension is under code stewardship review and recommends the Page Content Service for Wikimedia summaries. The repo's extract fetch uses the REST `page/summary` endpoint (`packages/data-pipeline/src/fetch/wikipedia-client.ts`), which is the lead only.
- **Wikidata dates** (`Help:Dates`): a time value has `precision` (9 = year, 10 = month, 11 = day), `calendarmodel` (proleptic Gregorian Q1985727 or Julian Q1985786; the page says dates before 1583 default to Julian in manual entry), no usable `before`/`after`, and the JSON export has no year 0 (1 BCE is `-0001`).
- **Wikidata access** (`Wikidata:Data_access`): the Action API returns JSON for up to 50 entities per request; use `maxlag`, honor `Retry-After` on 429, send a good User-Agent. Data is CC0 but asks for attribution.

### 2.6 What this repo already holds

- Lead extracts (`packages/data-pipeline/data/raw/*-wikipedia-extracts*.raw.json`), measured here. People: 3,827 entities, median 366 characters, max 1,519. Conflicts: 362 entities, median 483, max 1,258. Milestones: 542 entities, median 477, max 1,543. That is roughly 3 to 5 sentences each. The Muhammad extract, for example, has no events beyond a few generalities.
- Pantheon CSV (people): `birthyear`, `deathyear`, `occupation`, `bplace_country`, `wd_id` (ADR 0005 notes `wd_id` is retained for Q-ID-keyed enrichment). Conflicts and milestones: curated `year` plus Wikidata-derived dates and `wikipediaUrl`/`articleUrls`.

### 2.7 Live checks that shape the design **[verified live, 2026-10-25]**

- **Full article text is available and small enough to supply whole.** `action=query&prop=extracts&explaintext=1` without `exintro` returned the whole article. Plain-text sizes: Francis Drake 47,850 characters; Spanish Armada 58,968; Philip II of Spain 64,839; Isaac Newton 89,886; Elizabeth I 66,813. At a rough 4 characters per token **[estimate]** that is about 12k to 23k tokens each, so a 30-entity batch is well under a million input tokens. The API lowers `exlimit` to 1 for whole-article requests ("exlimit was too large for a whole article extracts request"), so fetch one article per request.
- **A Connection URL can resolve and still be the wrong entity.** `Armada Española` returned a redirect to `Spanish Navy` (Q676404), while `Spanish Armada` is Q179684. A 200 check passes both. The check must compare the resolved QID with the intended one, not just the status. A made-up title returns `missing`; a bad `/wiki/` URL returns 404.
- **Wikidata dates are not single-valued.** Drake's P569 has three statements: 1540-07-13 (day precision, Julian), 1545 (year precision), and a `preferred` 1540 (year precision). P570 has 1596-01-28 (`preferred`, Gregorian model) and 1596-01-27. A naive comparison against whichever statement comes first will raise false flags. A usable rule **[inference]**: compare years only, take the preferred-rank statement else the sole one, accept a year tolerance, and skip entities whose dates conflict at that level.

## 3. Options

### 3.1 Grounding: model memory vs Wikipedia text

| | Memory only | Lead extract in prompt | Full article in prompt |
|---|---|---|---|
| Input per entity | Name plus QID | About 370 to 480 characters (median) | About 48k to 90k characters (sample above) |
| Fits the claim set? | n/a | No: too short for 3 to 5 Key Moments and 3 obscure Deep Facts | Yes |
| Extra fetch | None | None (already in repo) | New pipeline fetch, cached in `data/raw` |
| Fabrication risk (2.1) | Highest for Deep Facts | Model fills gaps from memory anyway **[inference]** | Lowest; every claim can be required to quote the article |
| Machine check possible | Dates and URLs only | Dates and URLs; quote check only on the lead | Dates, URLs, quotes, numbers, names |
| Russian | Weak: prompt wants English titles | ru lead exists (`*.ru.raw.json`) | ru article by the same call |

Grounding ties the model to Wikipedia's account, so a Wikipedia error propagates; it verifies faithfulness to the source rather than truth. For a memory-oriented timeline that is a reasonable bar, and it lets a reviewer check a claim against one page. The open design point is how to treat "legend": a grounded model can only call something a legend if the article does, which fits the Deep Fact definition ("kept to what is documented; a legend is marked as one").

Mixed variants exist **[inference]**: ground the Key Moments and Deep Facts in the article but let Connections draw on memory (candidates are then checked mechanically, 3.2). Connections gain from the model's broader knowledge of related entities, and they have the most reliable automatic check.

### 3.2 Cheap automatic checks (no second model)

All cheap, offline, deterministic. `validation` already has `schema_valid`, `related_returned`, `related_matched`; these would add failure reasons.

1. **Schema**: JSON parses; counts (at most 3 Deep Facts); enumerations (`confidence`, `is_legend`); categories drawn from the Occupation Domain and Region sets.
2. **Connection resolution**: normalize and redirect-resolve each URL in batches of 50, read `wikibase_item`, then match the QID to the dataset (the `related_matched` signal). Flag `missing`, and flag a redirect whose QID differs from the QID implied by the title the model wrote (the Armada example). A Connection naming an entity outside the dataset is not an error, it is hidden by design (map: "not in the dataset"), so record it separately from "does not resolve".
3. **Date check**: for each Key Moment date and any birth/death year in the overview, compare by year against Pantheon (people) or the curated/Wikidata year (conflicts, milestones). Preferred-rank statement, year tolerance, skip on conflicting statements (2.7). Use the full-article text as a second reference when grounded **[inference]**.
4. **Quote check** (needs full-article grounding): each `evidence` string must appear verbatim, after whitespace normalization, in the supplied text. Failure means retract or flag the claim.
5. **Numbers and names**: digits and capitalized tokens in a Deep Fact must occur in the article. Weak but catches invented figures **[inference]**.
6. **Stability** (optional, multiplies model cost by N): run the entity N times and flag Deep Facts that appear in only one sample (SelfCheckGPT / best-of-N). Useful only without grounding; with grounding the quote check does the same job more directly.

### 3.3 Second-model verifier

A separate call extracts each claim and asks, with the article only, "is this supported? quote the supporting sentence" (the Anthropic verify-with-citations pattern and the FActScore/SAFE shape). Points from the evidence:

- Use a different model, or at least a fresh context that does not see the writer's reasoning, because evaluators favor their own output (Panickssery) and CoVe depends on independent verification.
- The lit reports verifiers close to human agreement (SAFE about 72% agreement; FActScore estimator within 2% on scores) but not equal to it; a verifier misses some errors and flags correct claims.
- Cost scales with claims, not entities: about 15 claims per Profile **[estimate]**, so a few hundred calls for 30 entities. Cheap in money, but it adds a stage, a prompt, and its own `prompt_hash`.
- With quote verification (3.2 item 4), a verifier mostly adds a semantic check that the quote does support the claim as phrased. That is the one thing substring matching cannot tell.

### 3.4 `confidence`, `is_legend`, and `review.status`

- `confidence` and `is_legend` are model self-reports. Self-evaluation is informative (Kadavath) but not calibrated on new tasks; so the fields are better treated as triage signals than as correctness gates **[inference]**. If grounded, `confidence` can be derived rather than asked: high only when the evidence quote verified, medium when the article supports it only loosely or only by inference **[inference]**.
- `is_legend` has no external truth source; the article's own wording ("according to tradition", "legend") is the best available anchor. Review should look at every `is_legend: false` Deep Fact whose article sentence is hedged.
- `review.status`: `draft` (generated, automatic checks passed or failed with reasons), `reviewed` (a human read it and changed nothing; regeneration at a new `prompt_hash` may replace it), `edited` (a human changed it; the map already says never overwrite). One gap **[inference]**: nothing records what the reviewer saw. Storing a hash of the article text used for grounding in `meta` would let a stale grounding input be detected and would make a reviewed result reproducible.

### 3.5 Reviewer effort for 30 entities **[estimate, my assumptions, not sourced]**

Assumptions: about 15 claims per Profile (overview, 3 to 5 Key Moments, up to 3 Deep Facts, about 5 Connections), reviewer is the project owner, English first.

| Setup | Per entity | 30 entities | Basis |
|---|---|---|---|
| Memory-only, no checks | 15 to 25 min: verify each claim against an outside source | 7.5 to 12.5 h | Every claim is unsupported until the reviewer finds a source |
| Grounded plus automatic checks (3.1 full article, 3.2) | 5 to 10 min: read the flagged items, skim the rest against the article | 2.5 to 5 h | Most claims arrive with a verified quote |
| Grounded plus checks plus verifier | 4 to 8 min | 2 to 4 h | Fewer false negatives to chase; the saving is modest at this scale |

The Russian pass adds a read of each Russian text; if the Russian is generated from the Russian article, the reviewer can limit it to flagged items and a structural comparison with the English **[inference]**. The first run will cost more because the checks and prompt will need tuning against real output; reserve time for one or two prompt iterations before the full 30.

## 4. Recommended approach (not a decision)

1. **Ground Key Moments and Deep Facts on the full English (and for the Russian variant, Russian) Wikipedia article text**, fetched once per entity in the pipeline's fetch stage and cached in `data/raw` (one article per request, serial, descriptive User-Agent, `maxlag`). The existing lead extracts are too short to ground anything beyond the overview. Instruct: use only the supplied text, say "not documented" when it does not support a claim, mark a legend only as the article does.
2. **Add an `evidence` verbatim-quote field per Key Moment and Deep Fact**, and verify it by substring match in the pipeline. This replaces the Citations API, which cannot be combined with JSON schema output. It is a prompt-output change that ticket 02 should absorb; `evidence` need not ship to `web`.
3. **Let Connections come from model knowledge but validate them mechanically**: batched title to redirect to QID resolution, QID match against the dataset, and a flag when a redirect changes the QID. Record "outside dataset" separately from "does not resolve".
4. **Run the date check** by year with preferred-rank and tolerance rules, against Pantheon and curated/Wikidata years.
5. **Skip the second-model verifier for the 30-entity batch.** Revisit when scale rises, using a different model and claim-level checking. At 30 entities, a human pass over the flagged items is cheaper than building and tuning another stage.
6. **Treat `confidence` as derived from verification and as a triage signal**, not as a gate; mark every Profile `draft` until a human reads it. Sort the review queue by failed checks, then by `is_legend` and `medium` Deep Facts.
7. **Add the article text hash to `meta`** next to `prompt_hash` so grounding drift is detectable.

Expected effect **[inference]**: this converts most unverifiable memory claims into verified quotes plus mechanically checked dates and links, bringing review to roughly the 2.5 to 5 hour band for 30 entities (3.5). What it cannot catch: an error that is in Wikipedia itself, a quote that supports a sentence only loosely, and an unflagged omission.

## 5. Open questions for the downstream tickets

- Ticket 02: does the person prompt accept the full article as input and an `evidence` field in its output? Conflicts and milestones (ticket 07) need the same shape; do their articles ground as well as biographies (lists and event articles are long and section-heavy)?
- Ticket 03: where the article fetch sits in the stage order, whether the raw article text is committed (sizes above: tens of KB each, about 1.5 to 3 MB for 30 entities, **[estimate]**), and whether TextExtracts or the Page Content Service is the long-term fetch path given the stewardship note in 2.5.
- Whether the date tolerance is exact year or a few years for ancient entities, where Wikidata calendar and precision (century-level for many ancient dates) make exact matches unrealistic.
- Which flagged conditions block `draft` to `reviewed` and which only advise.

## Sources

- Anthropic, Reduce hallucinations: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
- Anthropic, Citations: https://platform.claude.com/docs/en/build-with-claude/citations
- MediaWiki API:Etiquette: https://www.mediawiki.org/wiki/API:Etiquette
- MediaWiki API:Query: https://www.mediawiki.org/wiki/API:Query
- MediaWiki API:Pageprops: https://www.mediawiki.org/wiki/API:Pageprops
- Extension:TextExtracts: https://www.mediawiki.org/wiki/Extension:TextExtracts
- Wikidata Help:Dates: https://www.wikidata.org/wiki/Help:Dates
- Wikidata Data access: https://www.wikidata.org/wiki/Wikidata:Data_access
- Min et al., FActScore: https://arxiv.org/abs/2305.14251
- Wei et al., Long-form factuality (SAFE): https://arxiv.org/abs/2403.18802
- Mallen et al., When Not to Trust Language Models: https://arxiv.org/abs/2212.10511
- Dhuliawala et al., Chain-of-Verification: https://arxiv.org/abs/2309.11495
- Manakul et al., SelfCheckGPT: https://arxiv.org/abs/2303.08896
- Kalai et al., Why Language Models Hallucinate: https://arxiv.org/abs/2509.04664
- Kadavath et al., Language Models (Mostly) Know What They Know: https://arxiv.org/abs/2207.05221
- Panickssery et al., LLM Evaluators Recognize and Favor Their Own Generations: https://arxiv.org/abs/2404.13076
- Repo: `packages/data-pipeline/src/fetch/wikipedia-client.ts`, `packages/data-pipeline/data/raw/*-wikipedia-extracts*.raw.json`, `packages/data-pipeline/docs/adr/0005-people-sourced-from-pantheon-not-wikidata.md`
