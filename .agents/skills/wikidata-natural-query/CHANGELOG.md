# Wikidata Natural Query - Changelog

## Version 3.0 - Focused Query Interface

### Breaking Changes

#### Removed Article Writing Feature

- **Removed**: Wikipedia-style comprehensive article generation
- **Reason**: Skill now focuses exclusively on querying and retrieving factual data from Wikidata
- **Impact**: Queries like "Write an article about X" are no longer supported
- **Alternative**: Use "Tell me about X" for structured information summaries

### Changes

#### Updated Scope

- Skill is now strictly for data querying and fact retrieval
- Simplified from "query + article writing" to "query only"
- Clearer focus on answering questions with Wikidata data
- Better alignment with skill's core purpose

#### Updated Documentation

- Removed all references to article writing from SKILL.md
- Updated description to remove "Write an article about..." pattern
- Modified Example 2 from "Comprehensive Article" to "Entity Information"
- Updated README.md to remove article-related examples
- Simplified response format guidance

#### New Response Format

**Before (v2.0):**

- "For Comprehensive Articles" section with Wikipedia-style formatting

**After (v3.0):**

- "For Entity Information" section with structured summaries
- Focus on bullet points and factual data presentation
- No extensive narrative or article structure

### Migration Guide

If you previously asked:

```
Write a Wikipedia article about Douglas Adams
```

Now use:

```
Tell me about Douglas Adams
```

You'll receive a structured summary with:

- Brief introduction
- Key properties (birth, death, occupation, etc.)
- Notable relationships
- Formatted as organized bullet points
- QID links for verification

---

## Version 2.0 - Enhanced Query Capabilities

### New Features

#### 1. SPARQL Query Support

- Execute complex queries to list and filter multiple entities
- Support for listing entities matching specific criteria
- Examples: "List all female Nobel Prize winners in Physics"
- Simple, modular SPARQL construction with basic SELECT queries
- Automatic integration with Wikidata Query Service endpoint

#### 2. Comparison Tables

- Side-by-side comparison of entities on specific properties
- Automatic property detection (height, population, area, dates)
- Formatted as markdown tables with QID links
- Clear conclusion statements
- Examples: "Compare heights of Burj Khalifa and Eiffel Tower"

#### 3. Timeline Queries

- Chronological sorting of events and historical data
- Extraction of temporal properties (start time, end time, point in time)
- Duration span calculations
- Bold date formatting for clarity
- Examples: "Timeline of World War II", "Timeline of Apollo program"

#### 4. Relationship Traversal

- Conversational context maintenance across queries
- Natural follow-up question handling
- Automatic entity focus updates
- Property chain following
- Examples: "Tell me about France" → "Who is the president?" → "Where was he born?"

### Improvements

#### Query Type Detection

- Added intelligent query classification system
- Decision matrix for routing queries to appropriate handlers
- Support for 9 distinct query patterns
- Automatic fallback handling

#### Enhanced Workflow

- Restructured workflow with clear type-based execution paths
- Modular approach: break complex queries into simpler steps
- Improved error handling for each query type
- Context management for conversational queries

#### Error Handling

- SPARQL-specific error handling (timeouts, syntax errors, empty results)
- Comparison failure handling (missing properties)
- Timeline issues handling (incomplete temporal data)
- Query simplification suggestions

#### Documentation

- 4 new example workflows (Examples 7-10)
- Updated README with new query type examples
- Enhanced QUICKSTART guide
- Added SPARQL endpoint documentation

### Technical Details

**New APIs Integrated:**

- Wikidata SPARQL Endpoint: `https://query.wikidata.org/sparql`

**New Capabilities:**

- SPARQL SELECT queries with filters
- Multi-entity property extraction
- Temporal data sorting and formatting
- Conversational context tracking

**Size Impact:**

- SKILL.md: 425 lines → 778 lines (+83%)
- Added ~350 lines of instructions
- Maintained lean, focused approach
- No bundled resources added (still 0)

### Breaking Changes

None - All existing functionality preserved and enhanced.

### Migration Notes

No migration required. Existing queries continue to work exactly as before. New query types are automatically detected and handled.

---

## Version 1.0 - Initial Release

### Core Features

- Entity search via Wikidata API
- Comprehensive data retrieval via qjson API
- Python computational analysis
- QID attribution and linking
- Multimedia formatting (images, audio, video)
- Smart disambiguation handling
- Fallback search logic
- Wikipedia-style article generation

---

**Latest Update**: January 2025
