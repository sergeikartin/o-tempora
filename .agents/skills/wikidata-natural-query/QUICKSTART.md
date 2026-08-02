# Wikidata Natural Query - Quick Reference

## Installation

```bash
cp -r wikidata-natural-query ~/.config/opencode/skills/
```

## Quick Start

Just ask questions in natural language:

- "What is the capital of France?"
- "Tell me about Marie Curie"
- "List all female Nobel Prize winners"
- "Compare Burj Khalifa and Eiffel Tower heights"
- "Timeline of World War II"

## Query Types

| Type                       | Example                                 | What It Does                           |
| -------------------------- | --------------------------------------- | -------------------------------------- |
| **Simple Fact**            | "What is the capital of Japan?"         | Returns quick fact with QID links      |
| **Biography**              | "Tell me about Einstein"                | Provides biographical overview         |
| **Comprehensive Article**  | "Write an article about Mars"           | Creates Wikipedia-style article        |
| **SPARQL List**            | "List all female Nobel Prize winners"   | Queries multiple entities with filters |
| **Comparison**             | "Compare Burj Khalifa and Eiffel Tower" | Side-by-side comparison table          |
| **Timeline**               | "Timeline of Apollo program"            | Chronological events with dates        |
| **Relationship Traversal** | "Who is the president?" (follow-up)     | Conversational entity exploration      |
| **Computation**            | "How many 'e's in 'elephant'?"          | Uses Python for calculations           |
| **Multimedia**             | "Show me the flag of Brazil"            | Returns images/audio/video             |

## Response Format

All responses include:

- ✅ QID attribution links: `[Entity](https://www.wikidata.org/wiki/QID)`
- ✅ Sourced data from Wikidata
- ✅ Multimedia when available
- ✅ Clear acknowledgment of missing data

## APIs Used

1. **Wikidata Search**: Finds entity QIDs

   ```
   https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}
   ```

2. **qjson API**: Retrieves entity data

   ```
   https://qjson.toolforge.org/{QID}.json
   ```

3. **SPARQL Endpoint**: Complex queries for lists/filtering

   ```
   https://query.wikidata.org/sparql
   ```

4. **Python**: For calculations (via bash tool)

## Common Wikidata Properties

| Property | Meaning       | Example               |
| -------- | ------------- | --------------------- |
| P31      | instance of   | Q5 (human)            |
| P18      | image         | photo URL             |
| P569     | date of birth | 1955-02-24            |
| P36      | capital       | Q90 (Paris)           |
| P2043    | length        | 6650 km               |
| P85      | anthem        | Q58353                |
| P106     | occupation    | Q1650915 (researcher) |

## Tips

✅ **Do:**

- Be specific: "Nile River" not just "Nile"
- Request format: "brief answer" vs "complete article"
- Use follow-ups: "Tell me more about their awards"
- Verify with QID links

❌ **Don't:**

- Assume very recent data exists
- Expect fictional entities (e.g., "Wakanda")
- Make excessive rapid-fire requests (rate limits)

## Troubleshooting

| Issue              | Solution                                           |
| ------------------ | -------------------------------------------------- |
| "No results found" | Try more general term or alternative spelling      |
| Multiple results   | Be more specific or choose from options            |
| Incomplete data    | Ask follow-up questions or check Wikidata directly |
| API error          | Wait briefly and retry                             |

## Examples

```
# Simple
"What is the capital of France?"
→ Paris [Q90]

# Biographical
"Tell me about Douglas Adams"
→ Full biography with QID links

# SPARQL List
"List all female Nobel Prize winners in Physics"
→ Marie Curie, Maria Goeppert Mayer, Donna Strickland, Andrea Ghez

# Comparison
"Compare heights of Burj Khalifa and Eiffel Tower"
→ Table showing Burj Khalifa: 828m, Eiffel Tower: 330m

# Timeline
"Timeline of Apollo program"
→ Chronological list: 1961-1972 with major missions

# Computation
"How many 'r's in 'raspberry'?"
→ 3 (uses Python)

# Article
"Write an article about the Moon"
→ Wikipedia-style comprehensive article

# Conversational
"Tell me about France" → "Who is the president?" → "Where was he born?"
→ Maintains context through conversation
```

## Advanced Usage

**Chain queries:**

```
You: Tell me about France
Claude: [France overview]
You: What is its capital?
Claude: [Paris info, knows context]
```

**Specify properties:**

```
"What is the P36 (capital) of France?"
```

**Bulk operations:**

```
"Compare populations of top 5 European cities"
```

## Limits

- 🌐 English only (currently)
- 📊 Wikidata completeness varies
- 🔢 Simple Python calculations only
- ⚡ Subject to API rate limits

## Links

- **Wikidata**: https://www.wikidata.org
- **qjson API**: https://qjson.toolforge.org
- **Full Documentation**: See README.md

---

**Quick Test**: Ask Claude: _"Tell me about Douglas Adams"_  
If you get a response with QID links, the skill is working! ✅
