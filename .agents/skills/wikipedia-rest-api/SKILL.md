---
name: wikipedia-rest-api
description: Comprehensive guide to Wikipedia REST API with 72 endpoints across core v1 APIs and extensions. Includes code generation for JavaScript, Python, Rust, and Go. Query builders, error handling, and real-world recipes for all common use cases.
---

# Wikipedia REST API

Master the Wikipedia REST API (also known as MediaWiki REST API) for reading, searching, and editing Wikipedia content programmatically. This skill covers all 72 endpoints, from core page operations to extension-specific features.

## What You'll Learn

- How to use all 72 REST API endpoints across Wikipedia
- Fetch articles, search Wikipedia, access revision history
- Transform content between wikitext and HTML formats
- Authenticate and edit Wikipedia pages
- Handle pagination, caching, and rate limiting
- Build efficient multi-language API clients
- Work with extension-specific APIs (OAuth2, campaign events, growth experiments)
- Generate boilerplate client code in JavaScript, Python, Rust, and Go

## When to Use This Skill

Use this skill when you need to:

- **Read Wikipedia content** - Fetch articles, search, access revisions
- **Edit Wikipedia pages** - Update content programmatically with proper authentication
- **Build Wikipedia tools** - Create bots, integrations, data analysis tools
- **Transform content** - Convert between wikitext and HTML
- **Access page metadata** - Get history, languages, media, links
- **Integrate Wikipedia** - Embed Wikipedia search in your application
- **Manage campaigns** - Use campaign event APIs for community initiatives
- **Work with user data** - Access contributor info, campaign participation

## Quick Start

### 1. Basic Page Fetch (JavaScript)

```javascript
// Fetch a Wikipedia article in HTML format
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Albert_Einstein/html",
);
const data = await response.json();
console.log(data.html); // Rendered HTML content
```

### 2. Search Wikipedia (Python)

```python
import requests

# Search for articles about quantum physics
response = requests.get(
    'https://en.wikipedia.org/w/rest.php/v1/search/page',
    params={'q': 'quantum physics', 'limit': 10}
)
results = response.json()
for page in results['pages']:
    print(f"{page['title']}: {page['excerpt']}")
```

### 3. Access Page History (Rust)

```rust
// Get revision history for a page
let client = reqwest::Client::new();
let response = client
    .get("https://en.wikipedia.org/w/rest.php/v1/page/Python_(programming_language)/history")
    .send()
    .await?;

let history = response.json::<serde_json::Value>().await?;
for revision in history["revisions"].as_array().unwrap_or(&vec![]) {
    println!("{}: {} bytes",
        revision["timestamp"],
        revision["size"]
    );
}
```

### 4. Edit a Page (Go)

```go
// Update page content (requires OAuth2 token)
client := &http.Client{}
req, _ := http.NewRequest(
    "PUT",
    "https://en.wikipedia.org/w/rest.php/v1/page/Sandbox",
    bytes.NewBuffer(jsonPayload),
)
req.Header.Set("Authorization", "Bearer "+token)
resp, _ := client.Do(req)
```

## Core Concepts

### API Base URL

```
https://en.wikipedia.org/w/rest.php
```

All endpoints are relative to this base. Other Wikipedia language versions use similar patterns:

- Spanish: `https://es.wikipedia.org/w/rest.php`
- French: `https://fr.wikipedia.org/w/rest.php`
- Any language: `https://[lang].wikipedia.org/w/rest.php`

### API Versioning

The skill documents **v1 endpoints** (stable) and extension endpoints (versioned similarly).

### Response Format

All responses are JSON with consistent structure. See `schemas.md` for common object definitions.

## API Categories

### 1. Core v1 APIs (29 endpoints)

**Page Operations** - Read and edit article content

- Get page source (wikitext)
- Get rendered HTML
- Update page content
- Create new pages
- Access page metadata (language links, media, lint info)

**Revision Access** - Work with page versions

- Get specific revisions
- Compare revisions
- Access page history with filters
- Get edit statistics

**Search** - Find articles

- Full-text search
- Title search
- Fuzzy matching

**Content Transformation** - Convert between formats

- Wikitext → HTML
- HTML → Wikitext
- Lint checks

**Files** - Access media and files

- File metadata
- Thumbnail information

📚 **Full reference**: See `core-apis.md`

### 2. Extension APIs (43 endpoints)

These APIs add specialized functionality:

- **campaignevents** (13 endpoints) - Campaign and event management
- **growthexperiments** (9 endpoints) - Newcomer mentorship and task suggestions
- **checkuser** (6 endpoints) - User investigation and IP analysis
- **oauth2** (5 endpoints) - OAuth2 authentication
- **ipinfo** (4 endpoints) - IP geolocation
- **Other extensions** (6 endpoints) - Math rendering, flagged revisions, polls, etc.

📚 **Full reference**: See `extensions.md`

## Code Generation

This skill can generate boilerplate client code for common operations:

### Generate JavaScript Client

```
Generate a JavaScript async function that:
- Fetches a Wikipedia article by title
- Returns the article with metadata
- Includes error handling
```

Response will include:

- Full working function with proper error handling
- JSDoc comments
- Usage examples
- Recommended HTTP client libraries

### Generate Python API Wrapper

```
Create a Python class that wraps the Wikipedia REST API with:
- Methods for page operations
- Search functionality
- Proper error handling and retry logic
- Supports both sync and async
```

### Generate Rust Async Client

```
Build a Rust HTTP client using tokio and reqwest that:
- Fetches and caches article data
- Implements proper error types
- Uses serde for JSON serialization
```

### Generate Go HTTP Handler

```
Create a Go HTTP server that:
- Proxies Wikipedia REST API calls
- Caches responses
- Implements rate limiting
```

## Authentication

### Public Data (No Auth Required)

Reading articles, searching, accessing public history requires no authentication:

```javascript
// Works without any auth
const response = await fetch(
  "https://en.wikipedia.org/w/rest.php/v1/page/Berlin/html",
);
```

### OAuth2 Authentication (For Editing)

Editing pages requires OAuth2:

1. Register OAuth2 application on Meta-Wiki
2. Get authorization code from user
3. Exchange code for access token
4. Use token in authorization header

📚 **Full guide**: See `best-practices.md` → Authentication section

## Common Workflows

### Read an Article with Metadata

```
Goal: Get an article's content, revisions, images, and language versions
Flow:
  1. GET /v1/page/{title}/with_html → Get content + metadata
  2. GET /v1/page/{title}/links/media → Get images/media
  3. GET /v1/page/{title}/links/language → Get other language versions
  4. GET /v1/page/{title}/history → Get edit history
Result: Complete article snapshot with all metadata
```

### Search and Display Results

```
Goal: Search Wikipedia and show results with thumbnails
Flow:
  1. GET /v1/search/page → Search with query and limit
  2. Use page.thumbnail URL for images
  3. Use page.excerpt for preview
  4. Paginate with limit parameter
Result: Search result page with previews
```

### Edit and Create Pages

```
Goal: Create or update a Wikipedia page
Flow:
  1. Authenticate with OAuth2
  2. GET /v1/page/{title} → Get current version (for conflict detection)
  3. POST/PUT /v1/page/{title} → Submit edited content
  4. Handle conflict errors gracefully
Result: Updated page with proper version tracking
```

### Convert Content Formats

```
Goal: Convert between wikitext and HTML
Flow:
  1. POST /v1/transform/wikitext/to/html → Convert wikitext to HTML
  2. OR POST /v1/transform/html/to/wikitext → Convert HTML to wikitext
  3. Use lint endpoint to validate
Result: Properly formatted content in desired format
```

## Best Practices

### Performance

- Use `bare` endpoint variant when you don't need rendered HTML
- Implement response caching with ETags
- Use search instead of fetching multiple pages
- Batch operations where possible
- Monitor rate limits via response headers

### Error Handling

- Implement exponential backoff for retries
- Handle 404s gracefully (page not found)
- Check response content-type headers
- Validate data before use
- Log failures for debugging

### Rate Limiting

- Default limit: Check response headers
- Backoff when rate limited (HTTP 429)
- Cache responses aggressively
- Use If-Modified-Since for conditional requests

📚 **Full guide**: See `best-practices.md`

## Error Handling

Common errors and solutions:

| Error                 | Cause              | Solution                   |
| --------------------- | ------------------ | -------------------------- |
| 404 Not Found         | Page doesn't exist | Check spelling, try search |
| 400 Bad Request       | Invalid parameters | Validate query parameters  |
| 429 Too Many Requests | Rate limited       | Implement backoff          |
| 500 Server Error      | API issue          | Retry with backoff         |
| 403 Forbidden         | Auth required      | Use OAuth2 for editing     |

📚 **Complete guide**: See `error-handling.md`

## Real-World Examples

The skill includes 10+ complete recipes covering:

1. Read article with metadata
2. Search and display results
3. Edit page content
4. Create new article
5. Compare revisions
6. Get page history
7. Transform content formats
8. Access file metadata
9. Multi-language article retrieval
10. OAuth2 authentication flow

Each recipe includes implementations in:

- **JavaScript** (fetch and axios)
- **Python** (requests and aiohttp)
- **Rust** (reqwest)
- **Go** (net/http)

📚 **All recipes**: See `examples.md`

## API Reference Structure

This skill includes comprehensive reference documentation:

| File                | Content                                                | Size  |
| ------------------- | ------------------------------------------------------ | ----- |
| `core-apis.md`      | All 29 v1 endpoints with parameters, schemas, examples | ~20KB |
| `extensions.md`     | All 43 extension endpoints organized by module         | ~15KB |
| `schemas.md`        | Common data structures, Page/Revision/User objects     | ~10KB |
| `best-practices.md` | Performance, caching, auth, rate limiting              | ~8KB  |
| `examples.md`       | 10+ real-world recipes in 4 languages                  | ~12KB |
| `error-handling.md` | Error codes, troubleshooting, debug tips               | ~5KB  |

## Tips & Tricks

1. **Use page keys for URLs** - Use `key` field for URL construction instead of `title`
2. **Check ETags** - Use If-None-Match to avoid re-fetching
3. **Prefer HTML endpoint** - For display purposes, use `/html` endpoint
4. **Bare is faster** - Use `/bare` when you don't need full metadata
5. **Caching is key** - Cache responses with TTL for better performance
6. **Test with Sandbox** - Use `Sandbox` page for testing edits
7. **Check licenses** - Always verify license terms in page response

## Requirements & Limits

- **No authentication required** for reading public content
- **OAuth2 required** for editing
- **Rate limits apply** - Check response headers
- **HTTPS only** - All connections must be HTTPS
- **User-Agent required** - Include descriptive User-Agent header

## Getting Help

- 🐛 **Debug errors**: See `error-handling.md` for troubleshooting
- 📖 **Learn more**: Check reference docs for endpoint details
- 💡 **See examples**: Browse `examples.md` for working code
- 🚀 **Generate code**: Ask for boilerplate for your language
- ⚡ **Optimize**: Check `best-practices.md` for performance tips

---

**API Documentation**: https://en.wikipedia.org/w/rest.php/specs/v0/module/-  
**MediaWiki API**: https://www.mediawiki.org/wiki/API  
**Creative Commons License**: CC BY-SA 4.0
