# Profile prompt (people and events)

- **Version:** 2.7.0
- **Prompt hash:** sha256 of the prompt text below (first 12 chars: `582b5b88c98d`)
- **Inputs:** `{type}` (person | conflict | milestone), `{name}`, `{dates}` (e.g. "c. 1540–1596", "1789–1799", "1969"), `{wikipedia_url}`
- **Replaces:** the v1 person and conflict prompts
- **Output format:** [Assessed Profile](profile-assessment.md)

## Prompt

Everything inside this block is sent to the model.

```text
You are writing a profile of a historical {type}: {name} ({dates}), {wikipedia_url}.
{type} is one of: person, conflict, milestone.

Return:
1. A short overview.
2. Key moments, each as a short story.
3. Up to 3 deep facts.
4. Connections to other people and events.

Every Key Moment and Deep Fact carries a source. Record the final wording and
its evidence once in the assessed Profile format for an independent audit.

Fetch and read trustworthy sources before drafting. Ground every factual
claim in fetched evidence. If you cannot fetch the evidence needed for a
substantive Profile, report the blocker and stop before returning a draft.

OVERVIEW
- One paragraph, 2 to 3 sentences.
- For a person: who they were, what they did, and where.
- For a conflict or milestone: what happened, who was involved, where,
  and how it ended.
- Write for a curious reader with no background knowledge.
  Lively and concrete, not dry encyclopedia style.
- No empty praise or drama like "great", "legendary" or "epic";
  let what happened speak for itself.

KEY MOMENTS
- 3 to 4 key moments. For a short, single event, 2 is fine.
- For a person: the turning points of their life and work.
  For a conflict or milestone: the moments that decided its course.
- Each starts with a short lead: the date and the essence in a few words.
- Then one paragraph telling the story in natural, flowing language:
  who was involved, plus one detail that makes it memorable
  (an image, a consequence, an irony). Don't repeat the lead.
- Save the most surprising detail for the end of the paragraph.
- Bold the important parts inline with **...**: key events, names, outcomes.
- Include a technological, historical or cultural breakthrough,
  if there was one.

DEEP FACTS
- Find well-documented details that make the subject memorable and
  build unexpected mental connections. Include obscure material when
  its connection or story makes it rewarding to understand. Explain
  enough context for a curious newcomer to appreciate it.
- Consider a wider pool of candidates before choosing at most 3
  complementary facts. Return only the selected paragraphs.
- Select using these criteria together; each fact can have different
  strengths:
  - Surprise: challenges an expectation or reveals something unfamiliar.
  - Concreteness: gives the reader an image, object, phrase or scene
    to remember.
  - Meaning: helps explain the subject or its historical context.
  - Connections: links the subject to another person, field, cultural
    reference or familiar idea. Explain the documented relationship
    that makes the association meaningful.
  - Distinctiveness: contains a revealing detail beyond generic biography.
  - Variety: adds something different from the overview, key moments
    and other deep facts.
- Let the story or association carry the hook; an obscure name,
  date or number alone is not enough. Choose the strongest set without
  a quota for accessible or difficult material.
- Vary the type. Use different types where possible:
  - hidden_story: a paradoxical or archival story, a myth or legend,
    or an unexpected connection to another field. Best when it
    breaks a common stereotype.
  - unique_detail: a tragedy, a curiosity, or an etymological paradox.
- One paragraph per fact. No word limit: take the space the story
  needs to be memorable, but cut anything that doesn't serve the hook.
- Each fact needs one hook that makes it stick: a twist, a vivid image,
  a famous line, a strange number, or an ironic contrast.
- Don't use the same shape for every fact. Vary how facts open
  and where the hook lands.
- Include at least one concrete detail people can picture.
- Documentation is required regardless of how engaging a fact is;
  apply VERIFIABILITY to every selected fact and its associations.
  Do not invent, embellish, or guess
  dates, numbers, or quotes. Paraphrase famous lines unless the
  exact wording is well documented.
- A myth or legend is allowed only if marked is_legend: true.
- Do not repeat the overview or key moments.
- Don't pad the list. If there aren't 3 truly strong facts,
  return fewer.

VERIFIABILITY
- Record each visible factual claim in its field's findings. Keep claims
  standalone and retain qualifications and attribution. For a legend,
  document the account and its origin.
- In each key moment and deep fact, set `source` to the public HTTPS
  page that best supports the passage's central claim. Prefer relevant
  primary records, scholarly work or publications from institutions
  with relevant expertise. Wikipedia is an option when it directly
  supports the claim. Additional evidence can support other details
  or corroborate the claim.
- Cite the final URL of a fetched page you used to support that passage.
  Include a section anchor only if confirmed. If no trustworthy page
  supports the central claim, find better evidence or revise or omit
  the passage.

WRITER'S EVIDENCE CHECK
- Outline the Profile so each passage serves a distinct purpose. Draft
  and check one passage at a time. Read each Key Moment's date, title
  and text together. Reread the assembled Profile for chronology,
  contradictions, repetition and balance. Recheck any changed wording.
- Before returning the draft, compare every reader-visible passage
  with its fetched excerpts, including the overview, dates, titles and
  Connection explanations. Split compound statements into individual
  claims and check both what the wording states and what it implies.
- Check which event each date describes. Preserve ranges, approximate
  dates and calendar distinctions. Evidence that work was underway by
  a date does not establish when it began. Check the scope of words
  such as "first", "only" and "largest".
- Check who acted, spoke or drew a conclusion. Keep attribution and
  uncertainty wherever the claim appears, including titles. Verify
  the direction and strength of causal links or influence. A citation
  establishes that one work cited another; influence needs its own evidence.
- Read credible competing accounts alongside the supporting excerpts.
  Qualify or attribute the wording to reflect material disagreements.
  Retain the competing excerpts as
  counterevidence even after revising the prose. Explain exactly what
  the evidence establishes for dates, attribution and causal claims.
- For each Key Moment and Deep Fact, match the citation to an exact
  excerpt that supports the central claim. In the assessment, link
  that excerpt and its source ID to a supported finding for the same
  passage. Apply the assessment's corroboration rules independently
  of the displayed citation.
- Fetch more precise evidence or revise wording that overstates it.
  Remove unsupported optional details and record unresolved disputes
  or gaps in the assessment. After editing, make sure findings still
  cover the final wording.

NEUTRALITY AND NUMBERS
- Describe all sides of a conflict or dispute in the same neutral,
  factual tone. Where causes, responsibility or names are disputed,
  say so and say whose view is whose, instead of picking a side.
- For casualties and other contested figures, give a commonly cited
  range and say it is an estimate. If there is no reliable estimate,
  leave the number out.
- Curiosities are welcome, but never make light of killing,
  atrocities or civilian suffering.
- For recent or ongoing events, avoid anecdotes, stick to
  well-established facts, and do not predict an outcome.

CONNECTIONS
- People and events that genuinely mattered to this {type}.
  Mix both kinds where relevant:
  - People: family, allies, rivals, mentors, leaders, commanders,
    key figures on every side, major influences.
  - Events: conflicts and milestones this person took part in or shaped,
    or that caused this event, grew out of it, or were part of it.
- Exclude anything connected only by happening at the same time.
- Rate each as high or medium importance. Leave out anything less important.
- For each, explain in one short sentence how it is connected,
  with a concrete detail (e.g. "Backed his voyages and knighted him
  aboard the Golden Hind in 1581").
- Give its English Wikipedia article URL in the form
  https://en.wikipedia.org/wiki/Article_Title (underscores, no anchors).
  Use the main article, not a disambiguation page.
  If you are not sure of the URL, leave it out. Never guess a URL.
- If you are not confident a connection is real, leave it out.

Return the assessed Profile as JSON. Use only plain text and paired
**bold** in the draft wording. Return at most 15 Connections, high importance first.
```

## Meta (added by the pipeline, not the model)

The model never fills these in: it doesn't know the date, the prompt
version, or what happened after its response. The pipeline adds a `meta`
object to every result after the response comes back.

```json
"meta": {
  "generated_at": "ISO 8601 timestamp, UTC",
  "prompt_version": "2.7.0",
  "prompt_hash": "first 12 chars of sha256 of the prompt text",
  "schema_version": 4,
  "model": "exact model ID",
  "reasoning_effort": "high",
  "temperature": null,
  "run_id": "batch identifier, e.g. 2026-10-25-batch-01",
  "locale": "en",
  "source": {
    "wikidata_qid": "resolved from wikipedia_url"
  },
  "tokens": { "input": 0, "output": 0 },
  "validation": {
    "schema_valid": true,
    "connections_returned": 0,
    "connections_matched_people": 0,
    "connections_matched_events": 0,
    "connections_unresolved": 0
  },
  "review": {
    "status": "draft | reviewed | edited",
    "reviewed_at": null
  }
}
```

| Field | Purpose |
|---|---|
| `generated_at` | When the writer produced the result, preserved from staged generation metadata; null when unknown. |
| `prompt_version` | Human-readable version of the prompt used for writing; null when unknown. Bump it on meaningful prompt changes. |
| `prompt_hash` | Hash captured from the prompt used for writing, preserved through finalization; null when unknown. Use it to find stale records to regenerate. |
| `schema_version` | The raw draft format. Version 4 stores passage citations in the draft and factual findings in the assessment or verification report. |
| `model`, `reasoning_effort`, `temperature` | Writer model and reasoning setting when known. Temperature stays null. Agent model and effort come from runtime metadata when available. |
| `run_id` | Groups a batch so one bad run can be rolled back or re-run. |
| `locale` | Language of the generated text, for the Russian version of the site. |
| `source.wikidata_qid` | The subject's Wikidata ID, resolved from `wikipedia_url` and asserted equal to the dataset entity's own QID. |
| `tokens` | Writer input/output usage when available. Session usage covers the writer agent's task including tool turns, not the full pipeline. Cached input and reasoning output remain within their corresponding totals. |
| `validation` | Whether the JSON passed the schema, and how many connections matched people and events in the dataset. A low match rate flags a bad run or a data gap. `connections_unresolved` counts URLs that do not resolve. Date and identity verification results live in the separate verification report; see `docs/profile-verification.md`. These generation counts do not grant approval. |
| `review.status` | `edited` protects hand-fixed prose from regeneration and automatic repair. Publishing also requires `review.approval`, a current policy/content/report receipt issued by `profiles verify`; changing the text invalidates it. See `docs/profile-verification.md`. |

## Matching connections

- Connections mix people and events; the model doesn't label which is which.
- Resolve each `wikipedia_url` to a Wikidata ID (`wbgetentities`,
  `sites=enwiki`, up to 50 titles per call; redirects are followed), then
  look the ID up in people, conflicts and milestones. Whichever dataset
  contains it decides the type. Drop anything that matches none.
- Connections are one-directional: if Drake lists the Spanish Armada, the
  Armada profile does not show Drake unless its own run lists him. Do not
  merge across profiles when building them.
