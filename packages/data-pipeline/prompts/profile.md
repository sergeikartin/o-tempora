# Profile prompt (people and events)

- **Version:** 2.2.0
- **Prompt hash:** sha256 of the prompt text below (first 12 chars: `246b7e0afd6f`)
- **Inputs:** `{type}` (person | conflict | milestone), `{name}`, `{dates}` (e.g. "c. 1540–1596", "1789–1799", "1969"), `{wikipedia_url}`
- **Replaces:** the v1 person and conflict prompts
- **Checked by:** `.claude/agents/profile-verifier.md`

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

Every key moment and deep fact also carries checkable claims and a source,
so a separate verifier can check them (see VERIFIABILITY).

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
- For every key moment and deep fact, list 2 to 4 claims: the facts
  the paragraph rests on.
- Each claim is one short, standalone sentence that can be checked
  on its own. Spell out names; no pronouns.
  Good: "Drake raided the port of Cádiz in 1587."
  Bad: "He then raided it."
- Together the claims must cover every date, number, name and
  cause-and-effect link in the paragraph. If a detail can't be stated
  as a claim you're confident in, remove it from the paragraph.
- Keep hedges in the claim: if the paragraph says "reportedly",
  so does the claim. For a legend, claim that the story exists and
  where it comes from, not that it happened.
- For every key moment and deep fact, give a source: the English
  Wikipedia article and section where the claims can be checked,
  as https://en.wikipedia.org/wiki/Article_Title#Section_Title.
  It may be another article than the subject's. If you are not sure
  of the section, give the article without a section.
  If the facts are not on Wikipedia, use "not_on_wikipedia".

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

Return JSON only:
{
  "subject": "{name}",
  "type": "{type}",
  "wikipedia_url": "{wikipedia_url}",
  "overview": "one paragraph",
  "key_moments": [
    {
      "date": "1577–1580",
      "title": "essence in a few words",
      "text": "one paragraph with **bold**",
      "claims": ["standalone checkable sentence"],
      "source": "https://en.wikipedia.org/wiki/Article_Title#Section_Title"
    }
  ],
  "deep_facts": [
    {
      "text": "one paragraph",
      "type": "hidden_story | unique_detail",
      "is_legend": false,
      "confidence": "high | medium",
      "claims": ["standalone checkable sentence"],
      "source": "https://en.wikipedia.org/wiki/... | not_on_wikipedia"
    }
  ],
  "connections": [
    {
      "name": "most common name",
      "wikipedia_url": "https://en.wikipedia.org/wiki/...",
      "connection": "one short sentence on how it is connected",
      "importance": "high | medium"
    }
  ]
}

Return at most 15 connections, high importance first.
```

## Meta (added by the pipeline, not the model)

The model never fills these in: it doesn't know the date, the prompt
version, or what happened after its response. The pipeline adds a `meta`
object to every result after the response comes back.

```json
"meta": {
  "generated_at": "ISO 8601 timestamp, UTC",
  "prompt_version": "2.2.0",
  "prompt_hash": "first 12 chars of sha256 of the prompt text",
  "schema_version": 3,
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
| `schema_version` | Which JSON shape this record follows, for validators and the frontend. v2: `key_moments`, `deep_facts`, `connections`; no categories. v3: adds `claims` and `source` to key moments and deep facts. |
| `model`, `reasoning_effort`, `temperature` | Writer model and reasoning setting when known. Temperature stays null. Session model/effort come from runtime metadata; unavailable fields stay null. |
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

Verification may replace a generated Wikipedia source or `not_on_wikipedia` with a fetched public HTTPS primary/scholarly source. The writer prompt stays memory-based; evidence and approval are added offline by `profiles verify`.
