---
name: wikidata-natural-query
description: Natural language interface for querying Wikidata. Use this skill when users ask questions about entities, facts, relationships, or want to explore Wikidata information. Handles entity search, data retrieval, and computational analysis of Wikidata content. Ideal for answering "What is...", "Tell me about...", or comparative/analytical questions about real-world entities.
---

# Wikidata Natural Query

## Overview

This skill enables answering natural language queries about Wikidata entities through a conversational interface. Query Wikidata to retrieve factual information and perform analytical operations on entity data. The skill handles entity disambiguation, data retrieval, and computational analysis seamlessly.

## Core Principles

When using this skill, adhere to these principles:

1. **Data-Driven Responses**: Base all answers strictly on Wikidata data retrieved through API calls. Never make assumptions or use knowledge not verified by Wikidata.

2. **Concise & Clear Communication**: Provide informative but brief responses focused on answering the specific question asked.

3. **QID Attribution**: Always include Wikidata QIDs as Markdown links in the format: `[entity label](https://www.wikidata.org/wiki/QID)`. This allows users to verify information and explore further.

4. **Multimedia Integration**: Present images, audio, and video from Wikidata using proper markdown/HTML formatting.

5. **Honest Limitations**: State "I don't know" if data is missing or incomplete. Suggest users contribute to Wikidata when data is outdated or insufficient.

## Workflow

Follow this systematic workflow when handling queries:

### 1. Parse the Query and Determine Type

Identify the main entity or topic and classify the query type to choose the appropriate approach:

| Query Pattern                   | Type                   | Approach                             |
| ------------------------------- | ---------------------- | ------------------------------------ |
| "Tell me about X"               | Entity lookup          | wbsearchentities + qjson             |
| "What is X?"                    | Entity lookup          | wbsearchentities + qjson             |
| "List all X that/with Y"        | SPARQL list query      | Wikidata Query Service               |
| "Show all X who/where Y"        | SPARQL list query      | Wikidata Query Service               |
| "Compare X and Y"               | Comparison             | Multiple entity lookups + table      |
| "Which is [bigger/older/etc]"   | Comparison             | Multiple entity lookups + comparison |
| "Timeline of X"                 | Timeline               | Extract temporal properties + sort   |
| "History of X"                  | Timeline               | Extract temporal properties + sort   |
| Follow-up about previous entity | Relationship traversal | Use context + property chain         |

**Examples:**

- "Tell me about France" → Entity lookup
- "List all female Nobel Prize winners" → SPARQL query
- "Compare heights of Eiffel Tower and Big Ben" → Comparison
- "Timeline of World War II" → Timeline query
- "Who is the president?" (after asking about France) → Traversal

### 2. Execute Based on Query Type

Choose the appropriate workflow:

#### 2A. For Entity Lookup

Search for Wikidata QID

Use `webfetch` to call Wikidata's search API to find possible QIDs for the entity:

```
GET https://www.wikidata.org/w/api.php?action=wbsearchentities&search={query}&language=en&limit=4&format=json&formatversion=2
```

**Important Fallback Logic**: If the first search returns no results, retry with a more general term extracted from the query.

**Example**:

- Query: "What is the national anthem of India?"
- First search: "National anthem of India" (may fail)
- Fallback search: "India" (will succeed, then find anthem in relationships)

The API returns results with structure:

```json
{
  "search": [
    {
      "id": "Q42",
      "label": "Douglas Adams",
      "description": "English science fiction writer and humourist"
    }
  ]
}
```

**Handle disambiguation when multiple results exist:**

**IMPORTANT**: When the search returns multiple possible matches, **ALWAYS ask the user for clarification** unless one result is unambiguously the correct match based on context.

**When to ask for clarification:**

- Multiple entities have similar or overlapping descriptions
- The query term is ambiguous (e.g., "Mercury" could be planet, element, god, or person)
- The user's intent is unclear from context
- No single result stands out as obviously correct

**How to present disambiguation:**

```
I found multiple entities matching "{query}". Which one did you mean?

- [Entity 1](https://www.wikidata.org/wiki/Q123) - description from Wikidata
- [Entity 2](https://www.wikidata.org/wiki/Q456) - description from Wikidata
- [Entity 3](https://www.wikidata.org/wiki/Q789) - description from Wikidata
- [Entity 4](https://www.wikidata.org/wiki/Q101112) - description from Wikidata

Please specify which one you're interested in.
```

**When NOT to ask (automatic selection acceptable):**

- Only one result returned from API
- Query includes disambiguating context (e.g., "Nile River" when "Nile" has multiple meanings)
- One result's description clearly matches the query context
- User has provided clarifying information in the conversation

### 3. Retrieve Entity Information

Once the QID is identified, fetch comprehensive data using `webfetch` to call the qjson API:

```
GET https://qjson.toolforge.org/{QID}.json
```

This returns complete entity information in JSON format including:

- Labels and descriptions
- Claims (properties and values)
- References and qualifiers
- Sitelinks to Wikipedia articles
- Multimedia files (images, audio, video)

Parse this JSON to extract relevant information for answering the query.

#### 2B. For SPARQL List Queries

When the query requires listing, filtering, or finding multiple entities matching criteria:

**API Endpoint:**

```
GET https://query.wikidata.org/sparql?query={SPARQL_QUERY}&format=json
```

**Query Construction Principles:**

- Keep queries simple and modular
- Use SELECT for lists
- Always include SERVICE wikibase:label for readable labels
- Common property shortcuts: wdt:P31 (instance of), wdt:P166 (award received), wdt:P21 (sex/gender)

**Basic Query Template:**

```sparql
SELECT ?item ?itemLabel WHERE {
  ?item wdt:P31 wd:Q5 .           # instance of human
  ?item wdt:P166 wd:Q38104 .      # award received: Nobel Prize in Physics
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50
```

**Modular Approach:** If query is complex, break into steps:

1. First query: Get list of QIDs
2. Second query: Fetch details for each QID using qjson
3. Combine results

**Example:** "List all female Nobel Prize winners in Physics"

**Workflow:**

1. Identify entities: female (Q6581072), Nobel Prize in Physics (Q38104)
2. Construct SPARQL:
   ```sparql
   SELECT ?person ?personLabel WHERE {
     ?person wdt:P31 wd:Q5 .
     ?person wdt:P21 wd:Q6581072 .
     ?person wdt:P166 wd:Q38104 .
     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
   }
   ```
3. Execute via webfetch
4. Parse results and present as numbered list with QID links

**Error Handling:**

- Query timeout: Simplify or add LIMIT
- Empty results: Verify QIDs are correct, inform user if no matches
- Syntax error: Check SPARQL syntax, retry with corrected query

#### 2C. For Comparison Queries

When comparing two or more entities on specific properties:

**Workflow:**

1. Identify entities to compare (search for each)
2. Determine comparison property based on query:
   - Height: P2048 (height) or P2043 (length)
   - Population: P1082
   - Area: P2046
   - Age/Date: P569 (birth date), P571 (inception)
3. Fetch property value for each entity from qjson
4. Format as markdown table with QID links

**Example:** "Compare heights of Eiffel Tower and Empire State Building"

**Workflow:**

1. Search "Eiffel Tower" → Q243
2. Search "Empire State Building" → Q9188
3. Fetch Q243 data, extract P2048 (height) → 330m
4. Fetch Q9188 data, extract P2048 (height) → 443m
5. Present as table:

| Entity                | Height | QID                                          |
| --------------------- | ------ | -------------------------------------------- |
| Eiffel Tower          | 330 m  | [Q243](https://www.wikidata.org/wiki/Q243)   |
| Empire State Building | 443 m  | [Q9188](https://www.wikidata.org/wiki/Q9188) |

**Result:** Empire State Building is 113m taller.

**Include:**

- Units for all measurements
- QID links for verification
- Clear conclusion statement

#### 2D. For Timeline Queries

When query asks for chronological events or history:

**Workflow:**

1. Identify the topic entity (e.g., "World War II" → Q362)
2. Fetch entity data from qjson
3. Extract temporal properties:
   - P580: start time
   - P582: end time
   - P585: point in time
4. Look for related events (check properties for sub-events, battles, etc.)
5. Sort chronologically
6. Format with dates prominently displayed

**Example:** "Timeline of World War II major events"

**Workflow:**

1. Search "World War II" → Q362
2. Fetch Q362, find P580 (start: 1939-09-01), P582 (end: 1945-09-02)
3. Optionally: Use SPARQL to find related events:
   ```sparql
   SELECT ?event ?eventLabel ?date WHERE {
     ?event wdt:P361 wd:Q362 .  # part of WWII
     ?event wdt:P585 ?date .     # point in time
     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
   }
   ORDER BY ?date
   ```
4. Present chronologically:

**World War II Timeline ([Q362](https://www.wikidata.org/wiki/Q362)):**

- **September 1, 1939** - Germany invades Poland, war begins
- **December 7, 1941** - Attack on Pearl Harbor
- **June 6, 1944** - D-Day landings in Normandy
- **May 8, 1945** - Victory in Europe Day
- **September 2, 1945** - Japan surrenders, war ends

**Duration:** 1939-1945 (6 years)

**Format:** Use bold for dates, include duration spans when available

#### 2E. For Relationship Traversal (Follow-ups)

When user asks follow-up questions about previously mentioned entities:

**Context Tracking:**

- Remember the last entity mentioned and its QID
- Recognize follow-up patterns: "Who...", "What...", "Where...", "When..."
- Parse relationship questions to identify target property

**Common Relationship Properties:**

- P6 (head of government), P35 (head of state)
- P50 (author), P800 (notable works)
- P22 (father), P25 (mother), P40 (child)
- P19 (place of birth), P20 (place of death)
- P108 (employer), P69 (educated at)

**Example Conversation:**

**User:** "Tell me about France"
→ Fetch Q142, provide information [Store context: current_entity = Q142]

**User:** "Who is the president?"
→ Recognize follow-up, fetch P6 from Q142 → Emmanuel Macron (Q3052772)
→ Answer: "The current president of France is [Emmanuel Macron](https://www.wikidata.org/wiki/Q3052772)" [Update context: current_entity = Q3052772]

**User:** "Where was he born?"
→ Recognize follow-up, fetch P19 from Q3052772 → Amiens (Q41604)
→ Answer: "He was born in [Amiens](https://www.wikidata.org/wiki/Q41604)"

**Context Management:**

- Update current entity when focus clearly shifts
- Maintain for 2-3 conversational turns
- Clear context if topic changes completely

### 3. Computational Analysis (if needed)

For mathematical or analytical questions (counting, comparing, calculating), write Python code and execute it using the `bash` tool:

```bash
python3 -c "
# Python code here
print(result)
"
```

**When to use Python**:

- Character/word counting ("How many 'r's are in 'raspberry'?")
- Length comparisons ("Which river is longer?")
- Date calculations ("How many years ago?")
- Statistical analysis of entity data
- Any mathematical operations on retrieved data

**Best Practice**: Keep Python code concise and inline. Extract necessary data from Wikidata first, then analyze it.

### 4. Format the Response

Structure the response based on query type:

#### For Simple Facts:

- Answer directly and concisely
- Include QID links: `[France](https://www.wikidata.org/wiki/Q142)`
- Add relevant images if available

#### For Entity Information ("Tell me about X"):

When asked about an entity, provide a structured summary:

- Brief introduction with description from Wikidata
- Key properties relevant to the entity (birth/death dates, occupation, nationality, etc.)
- Notable relationships (spouse, children, employer, awards, etc.)
- Present as organized bullet points or short paragraphs
- Include QID links for all related entities
- Add images if available (P18)
- Keep responses focused on factual data from Wikidata properties

**Example Response Format:**

"[Douglas Adams](https://www.wikidata.org/wiki/Q42) was an English writer and humorist.

- **Born:** 11 March 1952 in [Cambridge](https://www.wikidata.org/wiki/Q350)
- **Died:** 11 May 2001 in [Santa Barbara](https://www.wikidata.org/wiki/Q159288)
- **Occupation:** Writer, screenwriter, humorist
- **Notable works:** [The Hitchhiker's Guide to the Galaxy](https://www.wikidata.org/wiki/Q3107329)
- **Awards:** [Received multiple awards including...]

[Image if available]"

#### For Comparative/Analytical Queries:

- Show the computation/comparison process
- Present results clearly
- Include source data with QID links

#### For SPARQL List Results:

- Present as numbered or bulleted list
- Include QID links for each entity
- Add brief description from Wikidata
- State total count if relevant

#### For Timeline Queries:

- Display chronologically with dates in bold
- Use consistent date format (Month Day, Year)
- Include duration spans when available
- Group by periods if appropriate

#### For Relationship Traversal:

- Answer naturally referencing the context
- Update current entity focus seamlessly
- Use pronouns appropriately ("he", "she", "it")

### 5. Multimedia Formatting

Present multimedia content from Wikidata appropriately:

**Images**:

```markdown
![Description](image_url)
```

**Audio**:

```html
<audio controls><source src="audio_url" /></audio>
```

**Video**:

```html
<video controls><source src="video_url" /></video>
```

Always include descriptive alt text and captions when available.

## Example Workflows

### Example 1: Simple Fact Query

**User**: "What is the capital of France?"

**Workflow**:

1. Search for "France" → Get Q142
2. Fetch Q142 data from qjson.toolforge.org
3. Find P36 (capital) property → Paris (Q90)
4. Response: "The capital of [France](https://www.wikidata.org/wiki/Q142) is [Paris](https://www.wikidata.org/wiki/Q90)."

### Example 2: Entity Information

**User**: "Tell me about Douglas Adams"

**Workflow**:

1. Search for "Douglas Adams" → Get Q42
2. Fetch Q42 data from qjson.toolforge.org
3. Extract relevant information: birth, death, occupations, works, awards, etc.
4. Format as structured summary with bullet points
5. Include images (P18) if available
6. Provide QID links for verification

**Response**: "[Douglas Adams](https://www.wikidata.org/wiki/Q42) was an English writer and humorist.

- **Born:** 11 March 1952 in Cambridge
- **Died:** 11 May 2001 in Santa Barbara
- **Occupation:** Writer, screenwriter, humorist
- **Notable works:** The Hitchhiker's Guide to the Galaxy
- **Spouse:** Jane Belson (married 1991)"

### Example 3: Analytical Query

**User**: "Which is longer: the Nile or the Amazon?"

**Workflow**:

1. Search for "Nile" → Get Q3392, fetch data, find length (P2043)
2. Search for "Amazon" → Get Q3783, fetch data, find length (P2043)
3. Write Python code to compare:
   ```python
   nile_length = 6650  # km from Wikidata
   amazon_length = 6400  # km from Wikidata
   if nile_length > amazon_length:
       print(f"The Nile ({nile_length} km) is longer than the Amazon ({amazon_length} km)")
   ```
4. Execute via bash tool
5. Response with QID attribution and source data

### Example 4: Character Counting with Python

**User**: "How many 'r's are in 'raspberry'?"

**Workflow**:

1. Recognize this as a computational question
2. Write Python code:
   ```python
   word = "raspberry"
   count = word.lower().count('r')
   print(f"There are {count} letter 'r's in '{word}'")
   ```
3. Execute via bash tool
4. Return the result: "There are 3 letter 'r's in 'raspberry'."

### Example 5: Fallback Search Logic

**User**: "What is the national anthem of India?"

**Workflow**:

1. First search: "National anthem of India" → No clear QID result
2. **Fallback**: Search for "India" → Get Q668
3. Fetch Q668 data from qjson.toolforge.org
4. Find P85 (anthem) property → Jana Gana Mana (Q58353)
5. Fetch Q58353 for complete anthem information
6. Response with anthem details, audio file if available, and QID links

### Example 6: Handling Disambiguation

**User**: "Tell me about Paris"

**Workflow**:

1. Search for "Paris" → Returns multiple results:

   - Q90: capital and largest city of France
   - Q647268: city in Texas, United States
   - Q90: Paris, Tennessee
   - And potentially others

2. **Recognize ambiguity** - Multiple distinct entities with the name "Paris"

3. **Ask user for clarification**:

   ```
   I found multiple entities named "Paris". Which one did you mean?

   - [Paris](https://www.wikidata.org/wiki/Q90) - capital and largest city of France
   - [Paris](https://www.wikidata.org/wiki/Q647268) - city in Lamar County, Texas, United States
   - [Paris](https://www.wikidata.org/wiki/Q2062382) - city in Tennessee, United States
   - [Paris](https://www.wikidata.org/wiki/Q202402) - city in Kentucky, United States

   Please specify which one you're interested in.
   ```

4. **Wait for user response** (e.g., "the one in France")

5. **Proceed with correct entity**: Fetch Q90 data and provide comprehensive information about Paris, France

**Key Point**: Never guess or assume which entity the user means when multiple clear options exist. Always ask for clarification.

### Example 7: SPARQL List Query

**User**: "List all female Nobel Prize winners in Physics"

**Workflow**:

1. Recognize this as a SPARQL query (needs to list multiple entities with filters)
2. Identify required entities:
   - Nobel Prize in Physics: Q38104
   - Female: Q6581072
   - Human: Q5
3. Construct SPARQL query:
   ```sparql
   SELECT ?person ?personLabel ?year WHERE {
     ?person wdt:P31 wd:Q5 .
     ?person wdt:P21 wd:Q6581072 .
     ?person wdt:P166 wd:Q38104 .
     OPTIONAL { ?person wdt:P166 ?award . ?award wdt:P585 ?year }
     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
   }
   ```
4. Execute via webfetch to `https://query.wikidata.org/sparql`
5. Parse results and format as list:

**Female Nobel Prize Winners in Physics:**

1. [Marie Curie](https://www.wikidata.org/wiki/Q7186) - 1903
2. [Maria Goeppert Mayer](https://www.wikidata.org/wiki/Q60065) - 1963
3. [Donna Strickland](https://www.wikidata.org/wiki/Q51786) - 2018
4. [Andrea Ghez](https://www.wikidata.org/wiki/Q229049) - 2020

**Total:** 4 laureates

### Example 8: Comparison Table

**User**: "Compare the heights of Burj Khalifa and Eiffel Tower"

**Workflow**:

1. Recognize comparison query
2. Search "Burj Khalifa" → Q12495
3. Search "Eiffel Tower" → Q243
4. Fetch Q12495, extract P2048 (height) → 828m
5. Fetch Q243, extract P2048 (height) → 330m
6. Format as comparison table:

| Building     | Height | Location | QID                                            |
| ------------ | ------ | -------- | ---------------------------------------------- |
| Burj Khalifa | 828 m  | Dubai    | [Q12495](https://www.wikidata.org/wiki/Q12495) |
| Eiffel Tower | 330 m  | Paris    | [Q243](https://www.wikidata.org/wiki/Q243)     |

**Result:** Burj Khalifa is 498m taller than the Eiffel Tower.

### Example 9: Timeline Query

**User**: "Timeline of the Apollo program"

**Workflow**:

1. Search "Apollo program" → Q182415
2. Fetch Q182415 data, find P580 (start: 1961) and P582 (end: 1972)
3. Use SPARQL to find major missions:
   ```sparql
   SELECT ?mission ?missionLabel ?date WHERE {
     ?mission wdt:P361 wd:Q182415 .
     ?mission wdt:P585 ?date .
     SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
   }
   ORDER BY ?date
   LIMIT 10
   ```
4. Format chronologically:

**Apollo Program Timeline ([Q182415](https://www.wikidata.org/wiki/Q182415)):**

- **May 5, 1961** - First crewed Mercury flight (Freedom 7)
- **July 16, 1969** - [Apollo 11](https://www.wikidata.org/wiki/Q182556) launches
- **July 20, 1969** - First Moon landing (Apollo 11)
- **April 11, 1970** - [Apollo 13](https://www.wikidata.org/wiki/Q182683) launches (successful failure)
- **July 30, 1971** - [Apollo 15](https://www.wikidata.org/wiki/Q182701) lands on Moon
- **December 7, 1972** - [Apollo 17](https://www.wikidata.org/wiki/Q182725) final Moon mission

**Duration:** 1961-1972 (11 years)

### Example 10: Relationship Traversal

**User Conversation:**

**User**: "Tell me about India"
**Response**: [Provides overview of India [Q668](https://www.wikidata.org/wiki/Q668)]
[Context stored: current_entity = Q668]

**User**: "What is its capital?"
**Response**: Recognize follow-up. Fetch P36 from Q668 → New Delhi (Q987)
"The capital of India is [New Delhi](https://www.wikidata.org/wiki/Q987)"
[Context updated: current_entity = Q987]

**User**: "What is the population?"
**Response**: Recognize follow-up about New Delhi. Fetch P1082 from Q987
"New Delhi has a population of approximately 32.9 million in its metropolitan area (as of latest data in Wikidata)"

**Key Point**: Maintain conversational context to allow natural exploration without repeating entity names.

## Error Handling

### No Search Results

If searches fail even after fallback:

- Inform the user clearly: "I couldn't find information about {query} in Wikidata."
- Suggest alternative search terms
- Recommend the user add this entity to Wikidata

### Incomplete Data

If entity exists but lacks requested information:

- State what information is available
- Acknowledge what's missing: "Wikidata doesn't currently have information about..."
- Politely suggest: "You might consider contributing this information to Wikidata to help improve the knowledge base."

### API Errors

If API calls fail:

- Retry once with the same parameters
- If still failing, inform the user: "I'm having trouble connecting to Wikidata. Please try again in a moment."

### Ambiguous Entities

When multiple entities match and disambiguation is unclear:

**ALWAYS ask the user to clarify** by presenting options with their descriptions. Do NOT guess or assume which entity the user means.

**Format for disambiguation:**

```
I found multiple entities matching "{original_query}". Which one did you mean?

- [Entity Label 1](https://www.wikidata.org/wiki/QID1) - description from Wikidata
- [Entity Label 2](https://www.wikidata.org/wiki/QID2) - description from Wikidata
- [Entity Label 3](https://www.wikidata.org/wiki/QID3) - description from Wikidata

Please let me know which one you're interested in, or provide more context.
```

**Example:**

User asks: "Tell me about Mercury"

Response:

```
I found multiple entities named "Mercury". Which one did you mean?

- [Mercury](https://www.wikidata.org/wiki/Q308) - first planet from the Sun in the Solar System
- [Mercury](https://www.wikidata.org/wiki/Q925) - chemical element with symbol Hg and atomic number 80
- [Mercury](https://www.wikidata.org/wiki/Q183444) - Roman god of commerce and communication
- [Freddie Mercury](https://www.wikidata.org/wiki/Q15869) - British singer, songwriter, record producer

Please specify which one you'd like to know about.
```

**After clarification:** Once the user responds (e.g., "the planet"), proceed with fetching data for the correct entity.

### SPARQL Errors

When SPARQL queries fail or timeout:

**Query Timeout:**

- Simplify the query by adding LIMIT (e.g., LIMIT 50)
- Remove OPTIONAL clauses if not critical
- Break complex query into simpler steps

**Empty Results:**

- Verify QIDs are correct (search for entities first)
- Check property IDs (use common properties reference)
- Inform user: "No entities match these criteria in Wikidata"

**Syntax Errors:**

- Review SPARQL syntax (check brackets, periods, filters)
- Test with simpler version first
- Common issues: missing SERVICE wikibase:label, incorrect property format (use wdt: not wd:)

### Comparison Failures

When comparison properties are missing:

- State what data is available for each entity
- Example: "I can compare their heights, but population data is only available for Entity A"
- Offer partial comparison if some data exists
- Suggest contributing missing data to Wikidata

### Timeline Issues

When temporal data is incomplete:

- Present available dates with notes about missing information
- Example: "Start date: 1939, End date: Not specified in Wikidata"
- Use approximate dates if qualifiers indicate uncertainty
- Sort by available dates, place undated items at end

## Common Wikidata Properties

When parsing qjson responses, these properties frequently appear:

- **P31**: instance of (type/class of the entity)
- **P279**: subclass of (classification hierarchy)
- **P18**: image (main image)
- **P569**: date of birth
- **P570**: date of death
- **P19**: place of birth
- **P20**: place of death
- **P27**: country of citizenship
- **P106**: occupation
- **P36**: capital (of a country/region)
- **P625**: coordinate location
- **P2043**: length
- **P2044**: elevation above sea level
- **P85**: anthem
- **P495**: country of origin
- **P571**: inception (founding/creation date)

Parse the JSON structure to extract these and other properties as needed.

## Best Practices

1. **Always verify QIDs**: Don't assume a QID without searching. Entity IDs can be unexpected.

2. **Use descriptive labels**: Instead of "Q42 was born in Q84", write "[Douglas Adams](https://www.wikidata.org/wiki/Q42) was born in [London](https://www.wikidata.org/wiki/Q84)".

3. **Handle dates properly**: Wikidata dates use various formats. Parse and present them in human-readable format (e.g., "11 March 1952" not "+1952-03-11T00:00:00Z").

4. **Check for preferred rank**: When multiple values exist for a property, prefer those with "preferred" rank in Wikidata.

5. **Include units**: When presenting measurements, always include units (km, m, kg, etc.).

6. **Respect data licenses**: Wikidata content is CC0, but cite sources when available in references.

7. **Progressive detail**: Start with the most relevant information. Provide more detail only when asked for specific aspects.

8. **Test Python before executing**: For complex computations, mentally verify the logic before running.

## Tips for Users

To get the best results from this skill:

- **Be specific**: "Tell me about the Nile River" is better than "Tell me about the Nile" (which could be the river, or other entities named Nile)
- **Request formats**: Specify if you want "a brief answer" or "detailed information"
- **Ask follow-ups**: If initial results are ambiguous, ask for clarification or more detail
- **Verify important facts**: Use the provided QID links to check source data on Wikidata
- **Contribute back**: If you find missing or incorrect data, consider editing Wikidata directly

## Limitations

- **Language**: Currently only queries Wikidata in English (language=en)
- **API rate limits**: Excessive requests may be throttled
- **Data completeness**: Wikidata quality varies by topic. Some entities have extensive data, others are stubs
- **Timeliness**: Wikidata is community-maintained. Very recent events may not yet be included
- **Computational scope**: Python execution is best for simple calculations. Complex data science requires dedicated tools
