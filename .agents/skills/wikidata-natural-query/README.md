# Wikidata Natural Query - Usage Guide

A natural language interface for querying Wikidata through Claude/OpenCode.

## What is this?

The `wikidata-natural-query` skill enables Claude to answer questions about real-world entities using data from Wikidata, the free knowledge base containing structured data from Wikipedia and beyond. Ask questions in natural language and get accurate, sourced responses with proper attribution.

## Installation

1. Copy the `wikidata-natural-query` folder to your OpenCode skills directory:

   ```bash
   cp -r wikidata-natural-query ~/.config/opencode/skills/
   ```

2. The skill will be automatically loaded by OpenCode when you start a new session.

3. Verify installation by asking Claude: "Tell me about Douglas Adams"

## How It Works

The skill supports multiple query types with different operations:

1. **Entity Search & Lookup**: Searches Wikidata to find QIDs (entity identifiers) and retrieves entity data
2. **SPARQL Queries**: Executes complex queries to list/filter multiple entities matching criteria
3. **Comparison Analysis**: Compares properties across multiple entities with side-by-side tables
4. **Timeline Generation**: Extracts and sorts chronological data for historical queries
5. **Relationship Traversal**: Maintains conversational context to follow entity relationships
6. **Computational Analysis**: Uses Python for mathematical/analytical operations on the data

### Under the Hood

- **Wikidata Search API**: `https://www.wikidata.org/w/api.php?action=wbsearchentities`
- **qjson API**: `https://qjson.toolforge.org/{QID}.json` for detailed entity data
- **SPARQL Endpoint**: `https://query.wikidata.org/sparql` for complex queries
- **Python Execution**: Via bash tool for calculations and analysis

## Usage Examples

### Example 1: Simple Fact Retrieval

**Query:**

```
What is the capital of France?
```

**Expected Response:**

> The capital of [France](https://www.wikidata.org/wiki/Q142) is [Paris](https://www.wikidata.org/wiki/Q90).

**How it works:**

1. Searches Wikidata for "France" → finds Q142
2. Fetches Q142 data from qjson.toolforge.org
3. Extracts P36 (capital) property → Paris (Q90)
4. Formats response with QID links

---

### Example 2: Biographical Information

**Query:**

```
Tell me about Marie Curie
```

**Expected Response:**

> [Marie Curie](https://www.wikidata.org/wiki/Q7186) (1867-1934) was a Polish-French physicist and chemist who conducted pioneering research on radioactivity. She was the first woman to win a Nobel Prize, the first person to win the Nobel Prize twice, and the only person to win the Nobel Prize in two scientific fields (Physics in 1903 and Chemistry in 1911).
>
> Born in [Warsaw](https://www.wikidata.org/wiki/Q270), she moved to Paris to pursue her studies...
>
> [image of Marie Curie if available in Wikidata]

**How it works:**

1. Searches for "Marie Curie" → finds Q7186
2. Fetches comprehensive data including birth/death dates, occupations, awards, locations
3. Formats biographical information with QID attribution
4. Includes image if available (P18 property)

---

### Example 3: Comparative Analysis

**Query:**

```
Which river is longer: the Nile or the Amazon?
```

**Expected Response:**

> Based on Wikidata:
>
> - [Nile](https://www.wikidata.org/wiki/Q3392): 6,650 km
> - [Amazon](https://www.wikidata.org/wiki/Q3783): 6,400 km
>
> The Nile is longer by 250 km, making it the longest river in the world.

**How it works:**

1. Searches for "Nile" → Q3392, fetches length (P2043)
2. Searches for "Amazon" → Q3783, fetches length (P2043)
3. Writes Python code to compare lengths
4. Executes comparison via bash tool
5. Presents results with QID attribution

---

### Example 4: Mathematical/Analytical Query

**Query:**

```
How many times does the letter 'r' appear in 'raspberry'?
```

**Expected Response:**

> The letter 'r' appears 3 times in 'raspberry'.

**How it works:**

1. Recognizes this as a computational question
2. Writes Python code: `"raspberry".lower().count('r')`
3. Executes via bash tool
4. Returns the result

---

### Example 5: Multimedia Content

**Query:**

```
Show me the flag and national anthem of India
```

**Expected Response:**

> ## [India](https://www.wikidata.org/wiki/Q668)
>
> **Flag:** > ![Flag of India](flag_image_url)
>
> **National Anthem:** [Jana Gana Mana](https://www.wikidata.org/wiki/Q58353)
>
> <audio controls><source src="anthem_audio_url"></audio>
>
> Composed by [Rabindranath Tagore](https://www.wikidata.org/wiki/Q7241), adopted in 1950.

**How it works:**

1. Searches for "India" → Q668
2. Fetches flag image (P41) and anthem (P85)
3. Searches for anthem entity Q58353
4. Retrieves audio file if available
5. Formats with proper HTML audio tags

---

### Example 6: Handling Disambiguation

**Query:**

```
Tell me about Mercury
```

**Expected Response:**

> I found multiple entities named Mercury. Which one did you mean?
>
> - [Mercury](https://www.wikidata.org/wiki/Q308) - planet in the Solar System
> - [Mercury](https://www.wikidata.org/wiki/Q925) - chemical element with symbol Hg
> - [Mercury](https://www.wikidata.org/wiki/Q183444) - Roman god
> - [Freddie Mercury](https://www.wikidata.org/wiki/Q15869) - British singer and songwriter

**How it works:**

1. Searches for "Mercury" → finds multiple results
2. Presents options with descriptions from Wikidata
3. Waits for user clarification
4. Proceeds with selected entity

---

### Example 7: Fallback Search Logic

**Query:**

```
What is the national anthem of India?
```

**How it works:**

1. First search: "national anthem of India" → may return no clear match
2. **Fallback**: Searches for "India" → Q668
3. Fetches Q668 data, finds P85 (anthem) property
4. Follows to anthem entity Q58353
5. Returns comprehensive anthem information

This demonstrates the skill's intelligent fallback mechanism when specific searches fail.

---

### Example 8: Missing Data

**Query:**

```
What is the GDP of Wakanda?
```

**Expected Response:**

> I couldn't find information about "Wakanda" in Wikidata. This might be because:
>
> - The entity doesn't exist in Wikidata yet
> - It's a fictional entity (Wakanda is from Marvel Comics)
>
> If this should be a real-world entity, you might consider adding it to Wikidata to help improve the knowledge base.

**How it works:**

1. Searches for "Wakanda" → no results
2. Attempts fallback search → still no results
3. Acknowledges limitation honestly
4. Suggests user contribution

---

### Example 9: Complex Multi-Entity Query

**Query:**

```
Who are the founders of Google and when was it founded?
```

**Expected Response:**

> [Google](https://www.wikidata.org/wiki/Q95) was founded on September 4, 1998 by:
>
> - [Larry Page](https://www.wikidata.org/wiki/Q4934) - American computer scientist and entrepreneur
> - [Sergey Brin](https://www.wikidata.org/wiki/Q92764) - American computer scientist and entrepreneur
>
> Both founders met at [Stanford University](https://www.wikidata.org/wiki/Q41506) where they developed the Google Search algorithm as part of their research project.

**How it works:**

1. Searches for "Google" → Q95
2. Fetches data, finds P112 (founded by) and P571 (inception)
3. Extracts founder QIDs: Q4934, Q92764
4. Optionally fetches founder data for context
5. Formats response with all QID links

---

### Example 10: SPARQL List Query

**Query:**

```
List all female Nobel Prize winners in Physics
```

**Expected Response:**

> **Female Nobel Prize Winners in Physics:**
>
> 1. [Marie Curie](https://www.wikidata.org/wiki/Q7186) - 1903
> 2. [Maria Goeppert Mayer](https://www.wikidata.org/wiki/Q60065) - 1963
> 3. [Donna Strickland](https://www.wikidata.org/wiki/Q51786) - 2018
> 4. [Andrea Ghez](https://www.wikidata.org/wiki/Q229049) - 2020
>
> **Total:** 4 laureates

**How it works:**

1. Recognizes this as a SPARQL query (listing multiple entities with filters)
2. Constructs SPARQL query with filters for female (Q6581072) and Nobel Prize in Physics (Q38104)
3. Executes query via SPARQL endpoint
4. Parses results and presents as numbered list with QID links

---

### Example 11: Comparison Table

**Query:**

```
Compare the heights of Burj Khalifa and Eiffel Tower
```

**Expected Response:**

| Building     | Height | Location | QID                                            |
| ------------ | ------ | -------- | ---------------------------------------------- |
| Burj Khalifa | 828 m  | Dubai    | [Q12495](https://www.wikidata.org/wiki/Q12495) |
| Eiffel Tower | 330 m  | Paris    | [Q243](https://www.wikidata.org/wiki/Q243)     |

> **Result:** Burj Khalifa is 498m taller than the Eiffel Tower.

**How it works:**

1. Recognizes comparison query
2. Searches for both entities → Q12495, Q243
3. Fetches height property (P2048) for each
4. Formats as comparison table with conclusion

---

### Example 12: Timeline Query

**Query:**

```
Timeline of the Apollo program
```

**Expected Response:**

> **Apollo Program Timeline ([Q182415](https://www.wikidata.org/wiki/Q182415)):**
>
> - **May 5, 1961** - First crewed Mercury flight (Freedom 7)
> - **July 16, 1969** - [Apollo 11](https://www.wikidata.org/wiki/Q182556) launches
> - **July 20, 1969** - First Moon landing (Apollo 11)
> - **April 11, 1970** - [Apollo 13](https://www.wikidata.org/wiki/Q182683) launches (successful failure)
> - **July 30, 1971** - [Apollo 15](https://www.wikidata.org/wiki/Q182701) lands on Moon
> - **December 7, 1972** - [Apollo 17](https://www.wikidata.org/wiki/Q182725) final Moon mission
>
> **Duration:** 1961-1972 (11 years)

**How it works:**

1. Searches "Apollo program" → Q182415
2. Extracts start/end dates (P580/P582)
3. Uses SPARQL to find related missions with dates (P585)
4. Sorts chronologically and formats with bold dates

---

### Example 13: Relationship Traversal

**Query (Conversation):**

```
User: Tell me about France
Claude: [Provides overview of France]

User: Who is the president?
Claude: The current president of France is Emmanuel Macron

User: Where was he born?
Claude: He was born in Amiens
```

**How it works:**

1. First query: Fetches France (Q142) data
2. Second query: Recognizes follow-up, fetches P6 (head of government) from Q142
3. Third query: Recognizes follow-up about Macron, fetches P19 (place of birth)
4. Maintains conversational context throughout

---

## Tips for Best Results

### 1. Be Specific

- ✅ "Tell me about the Nile River"
- ❌ "Tell me about the Nile" (could be river, or other entities)

### 2. Specify Format

- "Give me a brief answer about..."
- "Give me detailed information about..."
- "Show me just the image of..."

### 3. Use Follow-Up Questions

If results are ambiguous or incomplete:

- "Tell me more about their early life"
- "What awards did they win?"
- "Show me images"

### 4. Verify Important Information

- Click the QID links to see source data on Wikidata
- Check references and citations
- Be aware of data completeness (varies by entity)

### 5. Ask Analytical Questions

The skill can handle:

- Comparisons: "Which is taller: Eiffel Tower or Empire State Building?"
- Calculations: "How long ago was the Moon landing?"
- Counting: "How many Nobel Prizes did Marie Curie win?"

### 6. Request Multimedia

- "Show me a picture of..."
- "What does the flag look like?"
- "Play the national anthem of..."

## Common Use Cases

### Research & Learning

- Quick facts for homework or research
- Structured information summaries on topics
- Biographical information on historical figures
- Geographic and scientific data

### Comparison & Analysis

- Comparing entities (sizes, dates, quantities)
- Finding relationships between entities
- Statistical analysis of Wikidata properties

### Data Verification

- Cross-checking facts against Wikidata
- Finding official names and identifiers
- Accessing structured data with citations

## Limitations

### Language Support

- **Current**: English only (`language=en`)
- **Future**: Multi-language support planned

### Data Completeness

- Wikidata quality varies by topic
- Some entities are well-documented, others are stubs
- Very recent events may not be included yet

### Rate Limits

- Excessive requests may be throttled by Wikidata API
- Normal usage patterns are fine

### Computational Scope

- Python execution is for simple calculations
- Complex data science requires dedicated tools
- Inline Python only (no external libraries)

### API Dependencies

- Requires internet connection
- Dependent on Wikidata and qjson.toolforge.org availability

## Troubleshooting

### "I couldn't find information about..."

**Solutions:**

- Try searching with a more common/general term
- Check spelling of entity name
- Try alternative names (e.g., "USA" vs "United States")
- The entity might not exist in Wikidata yet

### Disambiguation Issues

**Solutions:**

- Be more specific in your query
- Add context: "Mercury the planet" instead of just "Mercury"
- Choose from the disambiguation options provided

### Incomplete Responses

**Solutions:**

- Ask follow-up questions for more detail
- Request specific aspects: "Tell me about their awards"
- Request more detailed information if brief response is insufficient

### API Errors

**Solutions:**

- Wait a moment and try again
- Check your internet connection
- Try a simpler query first to test connectivity

## Contributing to Wikidata

If you find missing or incorrect information:

1. Visit [Wikidata.org](https://www.wikidata.org)
2. Create a free account
3. Navigate to the entity (use QID links from responses)
4. Click "Edit" to add or correct information
5. Provide references for your edits

Your contributions help improve the knowledge base for everyone!

## Advanced Usage

### Chaining Queries

Ask related follow-up questions to build context:

```
User: Tell me about France
Claude: [Provides overview of France]

User: What is its capital?
Claude: [Knows we're still talking about France, provides Paris]

User: Show me a picture of that city
Claude: [Shows Paris images]
```

### Requesting Specific Properties

If you know Wikidata properties:

```
What is property P36 (capital) of Q142 (France)?
```

### Bulk Comparisons

```
Compare the populations of the 5 largest cities in Europe
```

The skill will fetch multiple entities and analyze them.

## Examples by Category

### Historical Figures

- "Tell me about Cleopatra"
- "Who was Alan Turing?"
- "Give me information about Nelson Mandela"

### Geographic Entities

- "What is the highest mountain in the world?"
- "Tell me about the Amazon rainforest"
- "Show me the flag of Japan"

### Scientific Concepts

- "What is the speed of light?"
- "Tell me about DNA"
- "Explain the James Webb Space Telescope"

### Cultural Items

- "What is the Mona Lisa?"
- "Tell me about the Beatles"
- "What is the national anthem of France?"

### Comparative Questions

- "Which is larger: Russia or China?"
- "Who lived longer: Einstein or Newton?"
- "What is the tallest building in the world?"

### Computational Questions

- "How many days until Christmas?" (with today's date)
- "Calculate the age of someone born in 1985"
- "How many letters in this word?"

## Feedback & Improvements

This skill is designed to be lean and leverage Claude's capabilities. If you find areas for improvement:

1. The skill can be extended with additional instructions
2. Common patterns can be documented in the SKILL.md
3. Python helper scripts can be added if frequently needed

## License

This skill interfaces with Wikidata, which provides data under CC0 (public domain). The skill itself is provided as-is for use with OpenCode/Claude.

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Maintained by**: Santhosh Thottingal
